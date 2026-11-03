package cn.tuxu.drawing

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import top.yukonga.miuix.kmp.basic.Button as MiuixButton
import top.yukonga.miuix.kmp.basic.ButtonDefaults as MiuixButtons
import top.yukonga.miuix.kmp.basic.Slider as MiuixSlider
import top.yukonga.miuix.kmp.basic.SliderDefaults as MiuixSliders
import top.yukonga.miuix.kmp.theme.MiuixTheme
import top.yukonga.miuix.kmp.theme.lightColorScheme as miuixLight
import top.yukonga.miuix.kmp.theme.darkColorScheme as miuixDark

class MainActivity:ComponentActivity() {
    override fun onCreate(savedInstanceState:Bundle?) {
        super.onCreate(savedInstanceState);enableEdgeToEdge();readerSensor()
        setContent { val scope=rememberCoroutineScope();val reader=remember {Reader(applicationContext,scope)};Studio(reader) }
    }
}
private val Paper=Color(0xfff8f7f4);private val Ink=Color(0xff252c29);private val Green=Color(0xff255f49)
internal data class Palette(val paper:Color,val nav:Color,val surface:Color,val ink:Color,val muted:Color,val border:Color,val accent:Color,val soft:Color)
internal val LocalPalette=staticCompositionLocalOf {Palette(Paper,Color(0xfff0efeb),Color.White,Ink,Color(0xff7a817a),Color(0xffe3e4dd),Green,Color(0xffe1ebe2))}
@Composable private fun TuxuTheme(dark:Boolean,content:@Composable ()->Unit) {
    val p=if(dark)Palette(Color(0xff1c2220),Color(0xff181e1b),Color(0xff262f29),Color(0xffe6eae4),Color(0xff9ba79c),Color(0xff353f37),Color(0xffa9d2ac),Color(0xff304833)) else LocalPalette.current
    val material=if(dark)darkColorScheme(primary=p.accent,onPrimary=p.paper,background=p.paper,onBackground=p.ink,surface=p.surface,onSurface=p.ink,surfaceVariant=p.nav,onSurfaceVariant=p.muted,outline=p.border) else lightColorScheme(primary=p.accent,onPrimary=Color.White,background=p.paper,onBackground=p.ink,surface=p.surface,onSurface=p.ink,surfaceVariant=p.nav,onSurfaceVariant=p.muted,outline=p.border)
    val miuix=if(dark)miuixDark(primary=p.accent,onPrimary=p.paper,disabledPrimaryButton=p.soft,disabledOnPrimaryButton=p.muted,tertiaryContainerVariant=p.soft,background=p.paper,onBackground=p.ink,surface=p.surface,onSurface=p.ink,secondaryVariant=p.nav,onSecondaryVariant=p.ink,dividerLine=p.border) else miuixLight(primary=p.accent,onPrimary=Color.White,disabledPrimaryButton=p.soft,disabledOnPrimaryButton=p.muted,tertiaryContainerVariant=p.soft,background=p.paper,onBackground=p.ink,surface=p.surface,onSurface=p.ink,secondaryVariant=p.nav,onSecondaryVariant=p.ink,dividerLine=p.border)
    CompositionLocalProvider(LocalPalette provides p) {MaterialTheme(colorScheme=material){MiuixTheme(colors=miuix,content=content)}}
}
@Composable internal fun Action(text:String,onClick:()->Unit,modifier:Modifier=Modifier,primary:Boolean=false,enabled:Boolean=true) {
    val p=LocalPalette.current
    MiuixButton(onClick=onClick,modifier=modifier,enabled=enabled,minWidth=44.dp,minHeight=44.dp,cornerRadius=12.dp,insideMargin=PaddingValues(horizontal=14.dp,vertical=10.dp),colors=if(primary)MiuixButtons.buttonColorsPrimary() else MiuixButtons.buttonColors()) {
        Text(text,color=if(!enabled)p.muted else if(primary)if(p.paper==Paper)Color.White else p.paper else p.ink,fontSize=14.sp,maxLines=1)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun Studio(reader:Reader) {
    val activity=LocalContext.current as? android.app.Activity
    val systemDark=isSystemInDarkTheme()
    val dark=when(reader.appearance){Appearance.DARK->true;Appearance.LIGHT->false;Appearance.SYSTEM->systemDark}
    val landscape=LocalConfiguration.current.orientation==android.content.res.Configuration.ORIENTATION_LANDSCAPE
    var forcedFull by rememberSaveable {mutableStateOf(false)}
    var portraitHeld by rememberSaveable {mutableStateOf(false)}
    var settings by rememberSaveable {mutableStateOf<String?>(null)}
    var showLibrary by rememberSaveable {mutableStateOf(false)}
    var showDetails by remember {mutableStateOf(false)}
    val fullscreen=(forcedFull||landscape)&&!portraitHeld&&settings==null
    fun leaveFullscreen(){forcedFull=false;portraitHeld=true;reader.fit();activity?.readerPortrait()}
    fun enterFullscreen(){portraitHeld=false;forcedFull=true;reader.fit();activity?.readerLandscape()}
    OrientationControls(activity,fullscreen,dark,portraitHeld){portraitHeld=false;activity?.readerSensor()}
    LaunchedEffect(fullscreen){if(fullscreen){showLibrary=false;reader.fit()}}
    val notice=reader.navigationNotice
    LaunchedEffect(notice?.id){if(notice!=null){delay(1800);reader.clearNotice(notice.id)}}
    BackHandler(settings!=null||showLibrary||reader.view.detail!=null||fullscreen) {
        when {settings=="appearance"->settings="root";settings!=null->settings=null;showLibrary->showLibrary=false;reader.view.detail!=null->reader.back();fullscreen->leaveFullscreen()}
    }
    TuxuTheme(dark) {
        val p=LocalPalette.current
        val root=if(fullscreen)Modifier.fillMaxSize().background(p.paper).displayCutoutPadding() else Modifier.fillMaxSize().background(p.paper).safeDrawingPadding()
        Box(root.testTag("reader-root").semantics {stateDescription=if(dark)"深色" else "浅色"}) {
            if(settings!=null)SettingsPage(reader,settings!!,{settings=it}){if(settings=="appearance")settings="root" else settings=null}
            else if(fullscreen) {
                Row(Modifier.fillMaxSize().testTag("fullscreen-reader")) {
                    Column(Modifier.width(108.dp).fillMaxHeight().padding(horizontal=12.dp,vertical=8.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                        ReaderIconButton("back","返回竖屏",{leaveFullscreen()},"exit-fullscreen")
                        Text(reader.question?.title.orEmpty(),color=p.ink,fontSize=20.sp,fontWeight=FontWeight.Medium,maxLines=2,modifier=Modifier.testTag("fullscreen-question-title"))
                        reader.question?.page?.let {Text("第 $it 页",fontSize=12.sp,color=p.muted)}
                        Text("双指缩放\n单指拖动\n双击适应",fontSize=12.sp,lineHeight=22.sp,color=p.muted)
                        Action("适应",reader::fit,Modifier.fillMaxWidth().testTag("fit-fullscreen"))
                        if(reader.view.detail!=null)Action("返回图",reader::back,Modifier.fillMaxWidth().testTag("back-detail-fullscreen"))
                        if(reader.frame?.hotspots?.isNotEmpty()==true&&reader.animation==null)Action("详图",{showDetails=true},Modifier.fillMaxWidth().testTag("details-fullscreen"))
                        Action("目录",{showLibrary=true},Modifier.fillMaxWidth())
                        ModeMenu(reader)
                    }
                    Box(Modifier.weight(1f).fillMaxHeight().padding(vertical=4.dp)) {DrawingSurface(reader,true,{enterFullscreen()},{showDetails=true})}
                    Column(Modifier.width(108.dp).fillMaxHeight().padding(horizontal=8.dp,vertical=12.dp)) {
                        StepProgress(reader,true)
                        NavigationControls(reader,true,Modifier.weight(1f).fillMaxWidth().padding(top=12.dp))
                    }
                }
            } else {
                BoxWithConstraints(Modifier.fillMaxSize()) {
                    val wide=maxWidth>=840.dp
                    Column(Modifier.fillMaxSize()) {
                        Row(Modifier.fillMaxWidth().height(60.dp).padding(horizontal=20.dp),verticalAlignment=Alignment.CenterVertically) {
                            Text("图序",fontSize=23.sp,fontWeight=FontWeight.SemiBold,color=p.ink)
                            Text("工程图学",Modifier.padding(start=12.dp).weight(1f),fontSize=12.sp,color=p.muted)
                            ReaderIconButton("settings","设置",{settings="root"},"settings")
                        }
                        Row(Modifier.weight(1f)) {
                            if(wide){LibraryPanel(reader,Modifier.width(280.dp).fillMaxHeight()){};Box(Modifier.width(1.dp).fillMaxHeight().background(p.border))}
                            Column(Modifier.weight(1f).fillMaxHeight().padding(horizontal=16.dp)) {
                                Row(Modifier.fillMaxWidth().height(80.dp),verticalAlignment=Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text((reader.library?.chapters?.find {it.id==reader.question?.chapter}?.title?:"工程图学")+(reader.question?.page?.let {" · 第 $it 页"}?:""),fontSize=11.sp,color=p.muted,maxLines=1,overflow=TextOverflow.Ellipsis)
                                        Text(reader.question?.title?:"打开题库",Modifier.testTag("question-title"),fontSize=30.sp,fontWeight=FontWeight.Medium,color=p.ink,maxLines=1,overflow=TextOverflow.Ellipsis)
                                    }
                                    if(!wide)Action("目录",{showLibrary=true},Modifier.testTag("library"))
                                    Spacer(Modifier.width(8.dp))
                                    Action(if(reader.question?.id in reader.bookmarks)"已收藏" else "收藏",reader::toggleBookmark,Modifier.testTag("bookmark"),enabled=reader.question!=null)
                                }
                                ModeBar(reader)
                                Box(Modifier.weight(1f).fillMaxWidth().padding(top=8.dp)) {DrawingSurface(reader,false,{enterFullscreen()},{showDetails=true})}
                                Column(Modifier.fillMaxWidth().height(112.dp).testTag("transport"),verticalArrangement=Arrangement.Bottom) {
                                    StepProgress(reader,false)
                                    NavigationControls(reader,false,Modifier.fillMaxWidth().height(52.dp).padding(top=0.dp))
                                    Spacer(Modifier.height(12.dp))
                                }
                            }
                        }
                    }
                }
            }
            if(showLibrary)ModalBottomSheet(onDismissRequest={showLibrary=false},containerColor=p.nav,dragHandle={BottomSheetDefaults.DragHandle()}) {LibraryPanel(reader,Modifier.fillMaxWidth().fillMaxHeight(.92f)){showLibrary=false}}
            if(showDetails)DetailChoices(reader){showDetails=false}
            if(notice!=null) {
                Surface(Modifier.align(Alignment.BottomCenter).padding(bottom=if(fullscreen)12.dp else 124.dp).testTag("navigation-notice").semantics(mergeDescendants=true){liveRegion=LiveRegionMode.Polite},color=p.ink,shape=RoundedCornerShape(16.dp),shadowElevation=3.dp) {
                    Text(notice.text,Modifier.padding(horizontal=16.dp,vertical=10.dp),fontSize=13.sp,color=p.paper)
                }
            }
        }
    }
}
@Composable private fun ModeMenu(reader:Reader) {
    var open by remember {mutableStateOf(false)}
    Box {
        Action(when(reader.view.mode){"question"->"题图 ▾";"supplement"->"补充 ▾";else->"答案 ▾"},{open=true},Modifier.fillMaxWidth())
        DropdownMenu(open,{open=false}) {
            DropdownMenuItem(text={Text("答案")},onClick={reader.mode("answer");open=false})
            if(reader.document?.questionFrames?.isNotEmpty()==true)DropdownMenuItem(text={Text("题图")},onClick={reader.mode("question");open=false})
            if(reader.document?.supplementFrames?.isNotEmpty()==true)DropdownMenuItem(text={Text("补充")},onClick={reader.mode("supplement");open=false})
            if(reader.document?.branches.orEmpty().size>1)reader.document?.branches?.forEach {branch->DropdownMenuItem(text={Text(branch.label)},onClick={reader.mode("answer",branch.id);open=false})}
        }
    }
}

@Composable private fun LibraryPanel(reader:Reader,modifier:Modifier,onOpen:()->Unit) {
    val p=LocalPalette.current;var chooseChapter by remember {mutableStateOf(false)}
    var expanded by remember {mutableStateOf(setOf<String>())}
    val currentPage=reader.question?.let {it.chapter+"/"+it.page}
    LaunchedEffect(currentPage){currentPage?.let {expanded=expanded+it}}
    Column(modifier.background(p.nav).padding(horizontal=16.dp)) {
        Text("题目索引",Modifier.padding(top=16.dp,bottom=14.dp),fontSize=19.sp,fontWeight=FontWeight.Medium,color=p.ink)
        OutlinedTextField(reader.query,{reader.query=it;reader.page=null},Modifier.fillMaxWidth().testTag("search"),placeholder={Text("题号、页码或章节",fontSize=13.sp)},singleLine=true,shape=RoundedCornerShape(12.dp))
        Row(Modifier.fillMaxWidth().padding(vertical=12.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            Action(reader.library?.chapters?.find {it.id==reader.chapter}?.title?.substringBefore(' ')?:"全部章节",{chooseChapter=true},Modifier.weight(1f))
            Action(if(reader.onlyBookmarks)"全部" else "收藏",{reader.onlyBookmarks=!reader.onlyBookmarks})
        }
        if(chooseChapter)AlertDialog(onDismissRequest={chooseChapter=false},title={Text("选择章节")},text={LazyColumn {item {Text("全部章节",Modifier.fillMaxWidth().clickable {reader.chapter=null;reader.page=null;chooseChapter=false}.padding(14.dp))};items(reader.library?.chapters.orEmpty()) {c->Text(c.title,Modifier.fillMaxWidth().clickable {reader.chapter=c.id;reader.page=null;chooseChapter=false}.padding(14.dp),color=if(reader.chapter==c.id)p.accent else p.ink)}}},confirmButton={})
        val matches=reader.matches
        Text("${matches.size} 道题目",Modifier.padding(bottom=8.dp),fontSize=11.sp,color=p.muted)
        LazyColumn(Modifier.weight(1f).testTag("question-tree"),contentPadding=PaddingValues(bottom=16.dp)) {
            if(matches.isEmpty())item {Text("没有找到对应题目，试试完整题号或页码。",Modifier.padding(vertical=24.dp),color=p.muted,fontSize=13.sp)}
            reader.library?.chapters?.forEach {chapter->
                val list=matches.filter {it.chapter==chapter.id}
                if(list.isNotEmpty()) {
                    item(key="chapter/${chapter.id}") {Text(chapter.title,Modifier.padding(top=18.dp,bottom=8.dp),color=p.muted,fontSize=12.sp,fontWeight=FontWeight.Medium)}
                    list.groupBy {it.page}.forEach { (page,questions)->
                        val key="${chapter.id}/$page";val opened=key in expanded||reader.query.isNotEmpty()||reader.onlyBookmarks
                        item(key="page/$key") {Row(Modifier.fillMaxWidth().clickable {expanded=if(key in expanded)expanded-key else expanded+key}.padding(vertical=12.dp),verticalAlignment=Alignment.CenterVertically) {Text(if(opened)"⌄" else "›",Modifier.width(20.dp),color=p.muted);Text(page?.let {"第 $it 页"}?:"绘图视频",Modifier.weight(1f),fontSize=13.sp,color=p.ink);Text("${questions.size}",fontSize=11.sp,color=p.muted)}}
                        if(opened)items(questions,key={it.id}) {q->
                            val selected=q.id==reader.question?.id
                            Row(Modifier.fillMaxWidth().padding(start=12.dp,bottom=4.dp).clip(RoundedCornerShape(10.dp)).background(if(selected)p.soft else Color.Transparent).clickable {reader.open(q.id);onOpen()}.testTag("question:${q.id}").padding(horizontal=12.dp,vertical=12.dp),verticalAlignment=Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {Text(q.title,fontSize=14.sp,fontWeight=if(selected)FontWeight.SemiBold else FontWeight.Normal,color=if(selected)p.accent else p.ink);Text(if(q.video)"绘图操作视频" else if(q.steps>0)"${q.steps} 步绘制" else if(q.details>0)"总图 · 可点详图" else "答案图",Modifier.padding(top=3.dp),fontSize=10.sp,color=p.muted)}
                                if(q.id in reader.bookmarks)Text("★",color=p.accent,fontSize=12.sp)
                            }
                        }
                    }
                }
            }
        }
        Text("离线题库 · 10 章 · 51 页",Modifier.padding(vertical=14.dp),fontSize=10.sp,color=p.muted)
    }
}
@Composable private fun ModeBar(reader:Reader) {
    val p=LocalPalette.current;val document=reader.document?:return
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
        listOf("answer" to "答案","question" to "题图","supplement" to "补充").forEach { (mode,label)->
            if(mode=="answer"||mode=="question"&&document.questionFrames.isNotEmpty()||mode=="supplement"&&document.supplementFrames.isNotEmpty()) {
                Text(label,Modifier.clip(RoundedCornerShape(10.dp)).background(if(reader.view.mode==mode)p.soft else p.nav).clickable {reader.mode(mode)}.padding(horizontal=16.dp,vertical=10.dp).testTag("mode:$mode"),color=if(reader.view.mode==mode)p.accent else p.muted,fontSize=13.sp)
            }
        }
        if(reader.view.mode=="answer"&&document.branches.size>1)document.branches.forEach {b->Text(b.label,Modifier.clip(RoundedCornerShape(10.dp)).background(if(reader.view.branch==b.id)p.soft else p.nav).clickable {reader.mode("answer",b.id)}.padding(horizontal=12.dp,vertical=10.dp),fontSize=12.sp,color=if(reader.view.branch==b.id)p.accent else p.muted)}
    }
}


@Composable private fun DrawingSurface(reader:Reader,fullscreen:Boolean,onFullscreen:()->Unit,onDetails:()->Unit) {
    val frame=if(reader.animation==null)reader.frame else null
    val hasRegions=frame?.hotspots?.isNotEmpty()==true
    var sourceInfo by remember {mutableStateOf(false)}
    var widget by remember {mutableStateOf<DrawingView?>(null)}
    Column(Modifier.fillMaxSize().clip(RoundedCornerShape(if(fullscreen)12.dp else 16.dp)).background(Color(0xff151e20))) {
        Row(Modifier.fillMaxWidth().height(40.dp).padding(horizontal=12.dp),verticalAlignment=Alignment.CenterVertically) {
            Text(if(reader.document?.video!=null)"绘图视频" else "绘图工作区",color=Color(0xffaab9ad),fontSize=11.sp,maxLines=1)
            if(hasRegions)Text("点击图上区域查看细节",Modifier.padding(start=10.dp).weight(1f).testTag("clickable-hint"),fontSize=11.sp,color=Color(0xffb8d1bc),maxLines=1,overflow=TextOverflow.Ellipsis)
            else Spacer(Modifier.weight(1f))
            if((frame?.emptyLinks?:0)>0||!reader.document?.answer.isNullOrBlank()||!frame?.captions.isNullOrEmpty()) {
                IconButton({sourceInfo=true},Modifier.size(32.dp).testTag("source-info")) {Text("ⓘ",fontSize=18.sp,color=Color(0xffaab9ad))}
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when {
                reader.error!=null->Text(reader.error!!,Modifier.align(Alignment.Center).padding(20.dp),color=Color(0xffffc8b4),fontSize=13.sp)
                reader.document?.video!=null->Video(reader.document!!.video!!)
                reader.frame!=null||reader.animation!=null->DrawingCanvas(reader,fullscreen){widget=it}
                reader.loading->CircularProgressIndicator(Modifier.align(Alignment.Center))
                else->Text("此入口暂无绘图画面",Modifier.align(Alignment.Center),color=Color.White,fontSize=13.sp)
            }
        }
        if(!fullscreen)Row(Modifier.fillMaxWidth().height(60.dp).horizontalScroll(rememberScrollState()).padding(horizontal=8.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(6.dp)) {
            if(reader.view.detail!=null||frame?.back!=null)Action("返回",reader::back,Modifier.testTag("back-detail"))
            if(reader.document?.video==null) {
                Action("−",{widget?.zoomBy(1/1.25f)})
                Action("适应",reader::fit,Modifier.testTag("fit"))
                Action("＋",{widget?.zoomBy(1.25f)})
                if(reader.animation!=null)Action("播放/暂停",{widget?.toggleAnimation()})
                if(hasRegions)Action("详图 ${frame!!.hotspots.size}",onDetails,Modifier.testTag("details"))
            }
            Action("全屏",onFullscreen,Modifier.testTag("enter-fullscreen"))
        }
    }
    if(sourceInfo)AlertDialog(onDismissRequest={sourceInfo=false},title={Text("资料说明")},text={Column(Modifier.verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        reader.document?.answer?.takeIf {it.isNotBlank()}?.let {Text(it)}
        frame?.captions?.forEach {Text(it)}
        if((frame?.emptyLinks?:0)>0)Text("原课件保存了 ${frame!!.emptyLinks} 条空图片路径，未提供可以可靠对应的图片文件名。这里显示的是目前已恢复的图稿。")
    }},confirmButton={TextButton({sourceInfo=false}){Text("知道了")}})
}
@Composable private fun DrawingCanvas(reader:Reader,fullscreen:Boolean,onWidget:(DrawingView)->Unit) {
    val context=LocalContext.current
    val animation=reader.animation
    val frame=if(animation==null)reader.frame else null
    val sequence=reader.sequence.mapNotNull {reader.document?.frames?.get(it)}
    val sequenceKey=sequence.joinToString("|"){it.id}
    var widget by remember {mutableStateOf<DrawingView?>(null)}
    var error by remember {mutableStateOf<String?>(null)}
    LaunchedEffect(frame?.id,animation?.id,widget,fullscreen,sequenceKey,reader.view.detail?.id) {
        val target=widget?:return@LaunchedEffect;target.expect(frame,animation?.id);error=null
        try {
            if(animation!=null) {
                val drawable=withContext(Dispatchers.IO){ScenePictures.animation(context,animation)};target.show(animation,drawable)
            } else if(frame!=null) {
                val detail=reader.view.detail!=null
                val rendered=withContext(Dispatchers.IO){val picture=ScenePictures.load(context,frame);picture to if(fullscreen){if(detail)ScenePictures.contentBounds(frame,picture) else ScenePictures.sequenceBounds(context,sequence,frame,picture)}else null}
                target.show(frame,rendered.first,rendered.second)
            }
        }catch(e:kotlinx.coroutines.CancellationException){throw e}
        catch(e:Exception){error="画面未打开：${e.message}"}
    }
    Box(Modifier.fillMaxSize()) {
        AndroidView(factory={DrawingView(it).also {v->widget=v;onWidget(v)}},modifier=Modifier.fillMaxSize().testTag("drawing-canvas"),update={v->v.fitContent=fullscreen;v.expect(frame,animation?.id);v.setCamera(reader.view.camera);v.onCamera=reader::camera;v.onHotspot=reader::detail})
        if(error!=null)Text(error!!,Modifier.align(Alignment.Center).padding(16.dp),color=Color(0xffffc8b4),fontSize=12.sp)
    }
}
@Composable private fun DetailChoices(reader:Reader,onDismiss:()->Unit) {
    AlertDialog(onDismissRequest=onDismiss,title={Text("图中详图")},text={Column(Modifier.verticalScroll(rememberScrollState())) {
        reader.frame?.hotspots?.forEachIndexed {i,h->Text(h.label.ifEmpty {"详图 ${i+1}"},Modifier.fillMaxWidth().testTag("hotspot:$i").clickable {reader.detail(h);onDismiss()}.padding(16.dp))}
    }},confirmButton={})
}
@Composable private fun StepProgress(reader:Reader,vertical:Boolean) {
    val p=LocalPalette.current;val count=reader.sequence.size
    val label=if(reader.document?.video!=null)"视频" else if(count>0)"${reader.view.step+1} / $count" else "—"
    if(vertical)Column(Modifier.fillMaxWidth().height(44.dp),horizontalAlignment=Alignment.CenterHorizontally) {
        Text(label,Modifier.testTag("step-label"),fontSize=12.sp,color=p.muted)
        MiuixSlider(progress=reader.view.step.toFloat(),onProgressChange={reader.step(it.toInt())},modifier=Modifier.fillMaxWidth().padding(top=8.dp).testTag("step-slider"),enabled=count>1,minValue=0f,maxValue=(count-1).coerceAtLeast(1).toFloat(),height=12.dp,decimalPlaces=0,colors=MiuixSliders.sliderColors(foregroundColor=p.accent,backgroundColor=p.soft,disabledForegroundColor=p.muted))
    } else Row(Modifier.fillMaxWidth().height(48.dp),verticalAlignment=Alignment.CenterVertically) {
        Text(label,Modifier.width(56.dp).testTag("step-label"),fontSize=12.sp,color=p.muted)
        MiuixSlider(progress=reader.view.step.toFloat(),onProgressChange={reader.step(it.toInt())},modifier=Modifier.weight(1f).testTag("step-slider"),enabled=count>1,minValue=0f,maxValue=(count-1).coerceAtLeast(1).toFloat(),height=16.dp,decimalPlaces=0,colors=MiuixSliders.sliderColors(foregroundColor=p.accent,backgroundColor=p.soft,disabledForegroundColor=p.muted))
    }
}
@Composable private fun NavigationControls(reader:Reader,vertical:Boolean,modifier:Modifier) {
    val previousStep=reader.view.detail!=null||reader.view.step>0
    val nextStep=reader.view.detail==null&&reader.view.step+1<reader.sequence.size
    val enabled=reader.question!=null&&!reader.loading
    @Composable fun PreviousPair(modifier:Modifier) {
        if(vertical)Column(modifier,verticalArrangement=Arrangement.spacedBy(8.dp)) {
            NavigationButton("上一题",{reader.nextQuestion(-1)},Modifier.weight(if(previousStep)1f else 2f).fillMaxWidth().testTag("previous-question"),enabled=enabled)
            if(previousStep)NavigationButton("上一步",{if(reader.view.detail!=null)reader.back() else reader.step(reader.view.step-1)},Modifier.weight(1f).fillMaxWidth().testTag("previous-step"),enabled=enabled)
        } else Row(modifier,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            NavigationButton("上一题",{reader.nextQuestion(-1)},Modifier.weight(if(previousStep)1f else 2f).fillMaxHeight().testTag("previous-question"),enabled=enabled)
            if(previousStep)NavigationButton("上一步",{if(reader.view.detail!=null)reader.back() else reader.step(reader.view.step-1)},Modifier.weight(1f).fillMaxHeight().testTag("previous-step"),enabled=enabled)
        }
    }
    @Composable fun NextPair(modifier:Modifier) {
        if(vertical)Column(modifier,verticalArrangement=Arrangement.spacedBy(8.dp)) {
            if(nextStep)NavigationButton("下一步",reader::nextStep,Modifier.weight(1f).fillMaxWidth().testTag("next-step"),primary=true,enabled=enabled)
            NavigationButton("下一题",{reader.nextQuestion(1)},Modifier.weight(if(nextStep)1f else 2f).fillMaxWidth().testTag("next-question"),primary=!nextStep,enabled=enabled)
        } else Row(modifier,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            if(nextStep)NavigationButton("下一步",reader::nextStep,Modifier.weight(1f).fillMaxHeight().testTag("next-step"),primary=true,enabled=enabled)
            NavigationButton("下一题",{reader.nextQuestion(1)},Modifier.weight(if(nextStep)1f else 2f).fillMaxHeight().testTag("next-question"),primary=!nextStep,enabled=enabled)
        }
    }
    if(vertical)Column(modifier.testTag("navigation-controls"),verticalArrangement=Arrangement.spacedBy(8.dp)) {PreviousPair(Modifier.weight(1f).fillMaxWidth());NextPair(Modifier.weight(1f).fillMaxWidth())}
    else Row(modifier.testTag("navigation-controls"),horizontalArrangement=Arrangement.spacedBy(8.dp)) {PreviousPair(Modifier.weight(1f));NextPair(Modifier.weight(1f))}
}
@Composable private fun NavigationButton(text:String,onClick:()->Unit,modifier:Modifier,primary:Boolean=false,enabled:Boolean=true) {
    val p=LocalPalette.current
    MiuixButton(onClick,modifier,enabled,minWidth=0.dp,minHeight=0.dp,cornerRadius=12.dp,insideMargin=PaddingValues(horizontal=4.dp,vertical=8.dp),colors=if(primary)MiuixButtons.buttonColorsPrimary() else MiuixButtons.buttonColors()) {
        Text(text,fontSize=14.sp,softWrap=false,maxLines=1,color=if(!enabled)p.muted else if(primary)if(p.paper==Paper)Color.White else p.paper else p.ink)
    }
}

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable private fun Video(path:String) {
    val context=LocalContext.current
    val player=remember(path) {ExoPlayer.Builder(context).build().apply {setMediaItem(MediaItem.fromUri("asset:///content/$path"));prepare();playWhenReady=false}}
    DisposableEffect(player){onDispose {player.release()}}
    AndroidView(factory={PlayerView(it).apply {this.player=player;useController=true}},modifier=Modifier.fillMaxSize(),update={it.player=player})
}
