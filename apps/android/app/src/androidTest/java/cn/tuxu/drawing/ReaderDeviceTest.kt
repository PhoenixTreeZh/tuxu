package cn.tuxu.drawing

import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ReaderDeviceTest {
    @get:Rule val rule=createAndroidComposeRule<MainActivity>()
    @Test fun librarySceneGraphAndVectorRedrawAreComplete() {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val library=Library(context)
        assertEquals(207,library.questions.size);assertEquals(10,library.chapters.size)
        val frames=linkedMapOf<String,Frame>();var animations=0;var videos=0
        library.questions.forEach {q->
            val doc=library.document(q.id);frames.putAll(doc.frames)
            if(doc.video!=null){
                context.assets.openFd("content/${doc.video}").use {fd->
                    val metadata=android.media.MediaMetadataRetriever()
                    try {metadata.setDataSource(fd.fileDescriptor,fd.startOffset,fd.length);assertNotNull(metadata.getFrameAtTime(0,android.media.MediaMetadataRetriever.OPTION_CLOSEST_SYNC)?.also {it.recycle()})}finally {metadata.release()}
                };videos++
            }
            doc.animations.values.forEach {a->assertTrue(ScenePictures.animation(context,a) is android.graphics.drawable.AnimatedImageDrawable)}
            animations+=doc.animations.size
            doc.branches.forEach {b->assertTrue(b.frames.isNotEmpty());b.frames.forEach {assertTrue(doc.frames.containsKey(it))}}
            doc.frames.values.forEach {f->f.hotspots.forEach {h->if(h.kind=="animation")assertTrue(doc.animations.containsKey(h.animation)) else assertTrue(doc.frames.containsKey(h.frame))}}
        }
        assertEquals(6,videos);assertTrue(animations>=14);assertTrue(frames.size>1000)
        val manifest=context.assets.open("content/scenes/manifest.json").bufferedReader().use {org.json.JSONObject(it.readText())}.getJSONArray("frames")
        for(i in 0 until manifest.length()) {
            val f=manifest.getJSONObject(i);val id=f.getString("id")
            if(id !in frames)frames[id]=Frame(id,f.getInt("width"),f.getInt("height"),(0..3).map {f.getJSONArray("viewport").getDouble(it).toFloat()},f.getString("svg"),emptyList(),null,emptyList(),0,f.getBoolean("vector"))
        }
        assertEquals(1316,frames.size)
        val renders=context.filesDir.resolve("android-svg-renders");renders.mkdirs()
        var drawn=0
        frames.values.forEach {f->
            val picture=ScenePictures.load(context,f)
            val bitmap=Bitmap.createBitmap(f.width,f.height,Bitmap.Config.ARGB_8888)
            Canvas(bitmap).drawPicture(picture);assertEquals(f.width,picture.width);assertEquals(f.height,picture.height)
            renders.resolve(f.id.replace('/','_')+".png").outputStream().use {bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
            bitmap.recycle();drawn++
        }
        val vector=frames.values.first {it.vector}
        val picture=ScenePictures.load(context,vector)
        val high=Bitmap.createBitmap(vector.width*3,vector.height*3,Bitmap.Config.ARGB_8888)
        Canvas(high).apply {scale(3f,3f);drawPicture(picture)}
        high.recycle()
        context.filesDir.resolve("scene-device-verification.json").writeText("{\"passed\":true,\"renderedFrames\":$drawn,\"videos\":$videos,\"vectorZoom\":3}")
    }
}
