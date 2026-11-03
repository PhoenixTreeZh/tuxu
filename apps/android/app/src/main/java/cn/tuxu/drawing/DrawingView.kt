package cn.tuxu.drawing

import android.content.Context
import android.graphics.Canvas
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.ImageDecoder
import android.graphics.Picture
import android.graphics.RectF
import android.graphics.drawable.AnimatedImageDrawable
import android.graphics.drawable.Drawable
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import com.caverock.androidsvg.SVG
import java.nio.ByteBuffer
import kotlin.math.min

object ScenePictures {
    private val sequenceBoundsCache=object:LinkedHashMap<String,RectF>(8,.75f,true) {
        override fun removeEldestEntry(eldest:MutableMap.MutableEntry<String,RectF>?)=size>8
    }
    private val boundsCache=object:LinkedHashMap<String,RectF>(8,.75f,true) {
        override fun removeEldestEntry(eldest:MutableMap.MutableEntry<String,RectF>?)=size>6
    }
    private val cache=object:LinkedHashMap<String,Picture>(8,.75f,true) {
        override fun removeEldestEntry(eldest:MutableMap.MutableEntry<String,Picture>?)=size>6
    }
    @Synchronized fun load(context:Context,frame:Frame,force:Boolean=false):Picture {
        if(force)cache.remove(frame.svg)
        cache[frame.svg]?.let {return it}
        val picture=context.assets.open("content/${frame.svg}").use {SVG.getFromInputStream(it).renderToPicture(frame.width,frame.height)}
        cache[frame.svg]=picture;return picture
    }
    fun animation(context:Context,animation:Animation):Drawable {
        val data=context.assets.open("content/${animation.path}").use {it.readBytes()}
        return ImageDecoder.decodeDrawable(ImageDecoder.createSource(ByteBuffer.wrap(data)))
    }
    @Synchronized fun contentBounds(frame:Frame,picture:Picture):RectF {
        boundsCache[frame.svg]?.let {return RectF(it)}
        val bitmap=Bitmap.createBitmap(frame.width,frame.height,Bitmap.Config.ARGB_8888)
        Canvas(bitmap).drawPicture(picture)
        val pixels=IntArray(frame.width*frame.height);bitmap.getPixels(pixels,0,frame.width,0,0,frame.width,frame.height);bitmap.recycle()
        var left=frame.width;var top=frame.height;var right=0;var bottom=0
        for(y in 0 until frame.height)for(x in 0 until frame.width) {
            val c=pixels[y*frame.width+x]
            if((c shr 16 and 255)>20||(c shr 8 and 255)>20||(c and 255)>20) {
                if(x<left)left=x;if(x>=right)right=x+1;if(y<top)top=y;if(y>=bottom)bottom=y+1
            }
        }
        val result=if(right>left&&bottom>top)RectF((left-3).coerceAtLeast(0).toFloat(),(top-3).coerceAtLeast(0).toFloat(),(right+3).coerceAtMost(frame.width).toFloat(),(bottom+3).coerceAtMost(frame.height).toFloat()) else RectF(0f,0f,frame.width.toFloat(),frame.height.toFloat())
        boundsCache[frame.svg]=result;return RectF(result)
    }
    @Synchronized fun sequenceBounds(context:Context,frames:List<Frame>,current:Frame,picture:Picture):RectF {
        if(frames.isEmpty()||frames.any {it.width!=current.width||it.height!=current.height})return contentBounds(current,picture)
        val key=frames.joinToString("|"){it.svg}
        sequenceBoundsCache[key]?.let {return RectF(it)}
        val result=RectF()
        for(frame in frames)result.union(contentBounds(frame,if(frame.svg==current.svg)picture else load(context,frame)))
        sequenceBoundsCache[key]=result;return RectF(result)
    }
}

/** Pictures retain drawing commands. Zoom redraws paths on Android's Canvas;
 * there is no full-frame screenshot in the rendering path. */
class DrawingView(context:Context):View(context),Drawable.Callback {
    var frame:Frame?=null;private set
    var displayedId:String?=null;private set
    private var expectedId:String?=null
    private var picture:Picture?=null
    private var animation:Drawable?=null
    private var sourceWidth=700f;private var sourceHeight=540f
    private var contentBounds=RectF(0f,0f,700f,540f)
    var fitContent=false
        set(value){if(field!=value){field=value;invalidate()}}
    var camera=Camera();private set
    var onCamera:(Camera)->Unit={}
    var onHotspot:(Hotspot)->Unit={}
    private var downX=0f;private var downY=0f;private var lastX=0f;private var lastY=0f
    private var moved=false;private var pinched=false
    private val density=resources.displayMetrics.density
    private val scaleDetector=ScaleGestureDetector(context,object:ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScaleBegin(detector:ScaleGestureDetector):Boolean {pinched=true;return true}
        override fun onScale(detector:ScaleGestureDetector):Boolean {
            zoomBy(detector.scaleFactor,detector.focusX,detector.focusY);return true
        }
    })
    private val tapDetector=GestureDetector(context,object:GestureDetector.SimpleOnGestureListener() {
        override fun onDown(event:MotionEvent)=true
        override fun onDoubleTap(event:MotionEvent):Boolean {updateCamera(Camera());return true}
    })
    init {setBackgroundColor(Color.rgb(21,30,32));isFocusable=true;contentDescription="绘图工作区，双指缩放，单指拖动，双击适应窗口";setLayerType(LAYER_TYPE_SOFTWARE,null)}
    private fun centerX()=if(fitContent)contentBounds.centerX() else sourceWidth/2
    private fun centerY()=if(fitContent)contentBounds.centerY() else sourceHeight/2
    internal fun visibleContentRect():RectF {
        val z=scale()
        return RectF(width/2f+camera.x+(contentBounds.left-centerX())*z,height/2f+camera.y+(contentBounds.top-centerY())*z,width/2f+camera.x+(contentBounds.right-centerX())*z,height/2f+camera.y+(contentBounds.bottom-centerY())*z)
    }
    internal fun contentSourceRect()=RectF(contentBounds)
    private fun scale():Float {
        val padding=(if(fitContent)8 else 32)*density
        return camera.zoom?:min((width-padding)/(if(fitContent)contentBounds.width() else sourceWidth),(height-padding)/(if(fitContent)contentBounds.height() else sourceHeight)).coerceAtLeast(.01f)
    }
    fun expect(value:Frame?,animationId:String?=null) {expectedId=animationId?:value?.id;frame=value}
    fun show(value:Frame,content:Picture,bounds:RectF?=null) {
        if(expectedId!=value.id)return
        stopAnimation();picture=content;displayedId=value.id;sourceWidth=value.width.toFloat();sourceHeight=value.height.toFloat();contentBounds=bounds?:RectF(0f,0f,sourceWidth,sourceHeight);invalidate()
    }
    fun show(value:Animation,content:Drawable) {
        if(expectedId!=value.id)return
        stopAnimation();picture=null;animation=content;content.callback=this
        displayedId=value.id;sourceWidth=value.width.toFloat();sourceHeight=value.height.toFloat()
        contentBounds=RectF(0f,0f,sourceWidth,sourceHeight)
        (content as? AnimatedImageDrawable)?.start();invalidate()
    }
    fun toggleAnimation() {(animation as? AnimatedImageDrawable)?.let {if(it.isRunning)it.stop() else it.start()}}
    private fun stopAnimation() {(animation as? AnimatedImageDrawable)?.stop();animation?.callback=null;animation=null}
    fun setCamera(value:Camera) {if(camera!=value){camera=value;invalidate()}}
    private fun updateCamera(value:Camera) {camera=value;onCamera(value);invalidate()}
    fun zoomBy(factor:Float,anchorX:Float=width/2f,anchorY:Float=height/2f) {
        val old=scale();val next=(old*factor).coerceIn(.05f,16f)
        val x=anchorX-width/2f;val y=anchorY-height/2f
        updateCamera(Camera(next,x-(x-camera.x)*next/old,y-(y-camera.y)*next/old))
    }
    override fun onDraw(canvas:Canvas) {
        super.onDraw(canvas)
        val saved=canvas.save();val z=scale()
        canvas.translate(width/2f+camera.x,height/2f+camera.y);canvas.scale(z,z);canvas.translate(-centerX(),-centerY())
        picture?.let {canvas.drawPicture(it,RectF(0f,0f,sourceWidth,sourceHeight))}
        animation?.let {it.setBounds(0,0,sourceWidth.toInt(),sourceHeight.toInt());it.draw(canvas)}
        canvas.restoreToCount(saved)
    }
    override fun onTouchEvent(event:MotionEvent):Boolean {
        scaleDetector.onTouchEvent(event);tapDetector.onTouchEvent(event)
        when(event.actionMasked) {
            MotionEvent.ACTION_DOWN->{parent.requestDisallowInterceptTouchEvent(true);downX=event.x;downY=event.y;lastX=event.x;lastY=event.y;moved=false;pinched=false}
            MotionEvent.ACTION_POINTER_DOWN->pinched=true
            MotionEvent.ACTION_POINTER_UP->{
                val remaining=if(event.actionIndex==0)1 else 0
                if(remaining<event.pointerCount){lastX=event.getX(remaining);lastY=event.getY(remaining);downX=lastX;downY=lastY;moved=false}
            }
            MotionEvent.ACTION_MOVE->{
                if(!scaleDetector.isInProgress&&event.pointerCount==1) {
                    if(kotlin.math.hypot(event.x-downX,event.y-downY)>5*density)moved=true
                    if(moved)updateCamera(Camera(scale(),camera.x+event.x-lastX,camera.y+event.y-lastY))
                }
                lastX=event.x;lastY=event.y
            }
            MotionEvent.ACTION_UP->{
                if(!moved&&!pinched&&displayedId==expectedId) {
                    val z=scale();val f=frame
                    val x=(event.x-width/2f-camera.x)/z+centerX()+(f?.viewport?.get(0)?:0f)
                    val y=(event.y-height/2f-camera.y)/z+centerY()+(f?.viewport?.get(1)?:0f)
                    f?.hotspots?.firstOrNull {h->x>=h.rect[0]&&x<h.rect[2]&&y>=h.rect[1]&&y<h.rect[3]}?.let(onHotspot)
                    performClick()
                }
                parent.requestDisallowInterceptTouchEvent(false)
            }
            MotionEvent.ACTION_CANCEL->parent.requestDisallowInterceptTouchEvent(false)
        }
        return true
    }
    override fun performClick():Boolean {super.performClick();return true}
    override fun onGenericMotionEvent(event:MotionEvent):Boolean {
        if(event.action==MotionEvent.ACTION_SCROLL){zoomBy(kotlin.math.exp(event.getAxisValue(MotionEvent.AXIS_VSCROLL)*.13f),event.x,event.y);return true}
        return super.onGenericMotionEvent(event)
    }
    override fun onDetachedFromWindow() {stopAnimation();super.onDetachedFromWindow()}
    override fun invalidateDrawable(who:Drawable)=invalidate()
    override fun scheduleDrawable(who:Drawable,what:Runnable,`when`:Long) {postDelayed(what,(`when`-android.os.SystemClock.uptimeMillis()).coerceAtLeast(0))}
    override fun unscheduleDrawable(who:Drawable,what:Runnable) {removeCallbacks(what)}
}
