package cn.tuxu.drawing

import android.content.Context
import androidx.compose.runtime.*
import kotlinx.coroutines.*

data class Camera(val zoom:Float?=null,val x:Float=0f,val y:Float=0f)
data class Detail(val kind:String,val id:String,val label:String)
data class Visit(val detail:Detail?,val camera:Camera)
data class ReadingView(val mode:String="answer",val branch:String="",val step:Int=0,val detail:Detail?=null,val history:List<Visit> = emptyList(),val camera:Camera=Camera())
enum class Appearance(val label:String) { DARK("深色"),LIGHT("浅色"),SYSTEM("跟随系统") }
data class NavigationNotice(val id:Long,val text:String)

class Reader(context:Context,private val scope:CoroutineScope) {
    private val prefs=context.getSharedPreferences("reader",Context.MODE_PRIVATE)
    var library by mutableStateOf<Library?>(null);private set
    var document by mutableStateOf<DrawingDocument?>(null);private set
    var view by mutableStateOf(ReadingView());private set
    var loading by mutableStateOf(true);private set
    var error by mutableStateOf<String?>(null);private set
    var navigationNotice by mutableStateOf<NavigationNotice?>(null);private set
    var query by mutableStateOf("")
    var chapter by mutableStateOf<String?>(null)
    var page by mutableStateOf<Int?>(null)
    var onlyBookmarks by mutableStateOf(false)
    var appearance by mutableStateOf(prefs.getString("appearance",null)?.let {value->Appearance.entries.find {it.name==value}}
        ?:if(prefs.contains("dark"))if(prefs.getBoolean("dark",false))Appearance.DARK else Appearance.LIGHT else Appearance.SYSTEM);private set
    var bookmarks by mutableStateOf(prefs.getStringSet("bookmarks",emptySet())!!.toSet());private set
    var recent by mutableStateOf(prefs.getString("recent","")!!.split('|').filter { it.isNotEmpty() });private set
    private val views=mutableMapOf<String,ReadingView>()
    private val alternatives=mutableMapOf<String,ReadingView>()
    private var opening:Job?=null
    val matches get()=library?.index?.search(query,chapter,page,if(onlyBookmarks)bookmarks else null).orEmpty()
    val question get()=document?.question
    val sequence:List<String> get()=when(view.mode) {
        "question"->document?.questionFrames.orEmpty()
        "supplement"->document?.supplementFrames.orEmpty()
        else->document?.branches?.find {it.id==view.branch}?.frames.orEmpty()
    }
    val frame get()=document?.frames?.get(if(view.detail?.kind=="frame")view.detail!!.id else sequence.getOrNull(view.step))
    val animation get()=if(view.detail?.kind=="animation")document?.animations?.get(view.detail!!.id) else null
    init { scope.launch {
        try {
            library=withContext(Dispatchers.IO){Library(context.applicationContext)}
            val saved=prefs.getString("lastQuestion",null)
            open(if(saved in library!!.byId)saved!! else library!!.questions.first().id)
        } catch(e:Exception){error="题库未打开：${e.message}";loading=false}
    } }
    fun open(id:String) {
        val source=library?:return
        navigationNotice=null
        question?.let {views[it.id]=view}
        opening?.cancel();loading=true;error=null
        opening=scope.launch {
            try {
                val next=withContext(Dispatchers.IO){source.document(id)}
                document=next;view=views[id]?:ReadingView(branch=next.branches.firstOrNull()?.id.orEmpty())
                recent=(listOf(id)+recent.filter {it!=id}).take(12)
                prefs.edit().putString("lastQuestion",id).putString("recent",recent.joinToString("|")).apply()
            } catch(e:CancellationException){throw e}
            catch(e:Exception){error="题目未打开：${e.message}"}
            finally {if(isActive)loading=false}
        }
    }
    private fun viewKey(mode:String=view.mode,branch:String=view.branch)="${question?.id}|$mode|$branch"
    fun mode(value:String,branch:String=view.branch) {
        alternatives[viewKey()]=view
        view=alternatives[viewKey(value,branch)]?:ReadingView(mode=value,branch=branch)
    }
    fun step(value:Int) {view=view.copy(step=value.coerceIn(0,(sequence.size-1).coerceAtLeast(0)),detail=null,history=emptyList(),camera=Camera())}
    fun nextStep() {if(view.history.isNotEmpty()||view.detail!=null)back() else if(view.step+1<sequence.size)step(view.step+1) else nextQuestion(1)}
    fun nextQuestion(direction:Int) {
        if(loading)return
        val ids=matches;val i=ids.indexOfFirst {it.id==question?.id}
        val next=ids.getOrNull(i+direction)?.takeIf {i>=0}
        if(next!=null)open(next.id)
        else navigationNotice=NavigationNotice(System.nanoTime(),when {
            ids.isEmpty()->"当前筛选没有题目"
            i<0->"请先选择筛选结果中的题目"
            direction<0->"已到当前筛选的第一题"
            else->"已到当前筛选的最后一题"
        })
    }
    fun canQuestion(direction:Int):Boolean {val ids=matches;val i=ids.indexOfFirst {it.id==question?.id};return i>=0&&i+direction in ids.indices}
    fun camera(value:Camera) {view=view.copy(camera=value)}
    fun detail(h:Hotspot) {
        if(h.kind=="back"){back();return}
        val target=if(h.kind=="animation")h.animation else h.frame
        if(target==null)return
        if(h.kind=="animation"&&document?.animations?.containsKey(target)!=true)return
        if(h.kind!="animation"&&document?.frames?.containsKey(target)!=true)return
        view=view.copy(detail=Detail(if(h.kind=="animation")"animation" else "frame",target,h.label),history=view.history+Visit(view.detail,view.camera),camera=Camera())
    }
    fun back() {
        val previous=view.history.lastOrNull()
        if(previous!=null)view=view.copy(detail=previous.detail,camera=previous.camera,history=view.history.dropLast(1))
        else if(view.detail!=null)view=view.copy(detail=null,camera=Camera())
        else frame?.back?.takeIf {document?.frames?.containsKey(it)==true}?.let {view=view.copy(detail=Detail("frame",it,"返回图"),camera=Camera())}
    }
    fun fit() {camera(Camera())}
    fun appearance(value:Appearance) {appearance=value;prefs.edit().putString("appearance",value.name).apply()}
    fun clearNotice(id:Long) {if(navigationNotice?.id==id)navigationNotice=null}
    fun toggleBookmark() {val id=question?.id?:return;bookmarks=if(id in bookmarks)bookmarks-id else bookmarks+id;prefs.edit().putStringSet("bookmarks",bookmarks).apply()}
}
