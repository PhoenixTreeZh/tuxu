package cn.tuxu.drawing

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.Normalizer

data class Question(val id:String,val chapter:String,val page:Int?,val key:String,val title:String,val aliases:List<String>,val steps:Int,val video:Boolean,val details:Int,val dataPath:String)
data class Chapter(val id:String,val title:String)
data class Hotspot(val id:String,val rect:List<Float>,val kind:String,val label:String,val frame:String?,val animation:String?)
data class Frame(val id:String,val width:Int,val height:Int,val viewport:List<Float>,val svg:String,val hotspots:List<Hotspot>,val back:String?,val captions:List<String>,val emptyLinks:Int,val vector:Boolean)
data class Branch(val id:String,val label:String,val kind:String,val frames:List<String>)
data class Animation(val id:String,val path:String,val width:Int,val height:Int)
data class DrawingDocument(val question:Question,val branches:List<Branch>,val questionFrames:List<String>,val supplementFrames:List<String>,val frames:Map<String,Frame>,val animations:Map<String,Animation>,val answer:String,val video:String?)
private fun JSONArray.strings()=(0 until length()).map { getString(it) }
private fun JSONObject.strings(name:String)=optJSONArray(name)?.strings().orEmpty()
private fun JSONObject.nullable(name:String)=if(isNull(name)||!has(name))null else getString(name)
private fun JSONObject.floats(name:String)=getJSONArray(name).let { a->(0 until a.length()).map { a.getDouble(it).toFloat() } }
private fun JSONArray.objects()=(0 until length()).map { getJSONObject(it) }
private fun question(o:JSONObject)=Question(o.getString("id"),o.getString("chapter"),if(o.isNull("page"))null else o.getInt("page"),o.getString("key"),o.getString("title"),o.strings("aliases"),o.getInt("steps"),o.getBoolean("video"),o.getInt("detailCount"),o.getString("dataPath"))

class Library(private val context:Context) {
    private fun read(path:String):JSONObject {
        require(!path.startsWith('/') && path.split('/').none { it==".." })
        return context.assets.open("content/$path").bufferedReader(Charsets.UTF_8).use { JSONObject(it.readText()) }
    }
    private val catalog=read("index/catalog.json")
    val questions=catalog.getJSONArray("questions").objects().map(::question)
    val chapters=catalog.getJSONArray("chapters").objects().map { Chapter(it.getString("id"),it.getString("title")) }
    val byId=questions.associateBy { it.id }
    val index=QuestionIndex(questions,chapters)
    private val documents=object:LinkedHashMap<String,DrawingDocument>(8,.75f,true) {
        override fun removeEldestEntry(eldest:MutableMap.MutableEntry<String,DrawingDocument>?)=size>8
    }
    @Synchronized fun document(id:String):DrawingDocument {
        documents[id]?.let { return it }
        val q=byId.getValue(id);val o=read(q.dataPath)
        val frames=o.getJSONObject("frames");val animations=o.getJSONObject("animations")
        val result=DrawingDocument(q,o.getJSONArray("branches").objects().map { Branch(it.getString("id"),it.getString("label"),it.getString("kind"),it.strings("frames")) },o.strings("questionFrames"),o.strings("supplementFrames"),
            frames.keys().asSequence().associateWith { key->
                val f=frames.getJSONObject(key)
                Frame(key,f.getInt("width"),f.getInt("height"),f.floats("viewport"),f.getString("svg"),f.getJSONArray("hotspots").objects().map { h->Hotspot(h.getString("id"),h.floats("rect"),h.getString("kind"),h.optString("label","详图"),h.nullable("target_frame_id"),h.nullable("target_animation_id")) },f.nullable("back"),f.strings("captions"),f.getInt("emptyLinks"),f.getBoolean("vector"))
            },animations.keys().asSequence().associateWith { key->val a=animations.getJSONObject(key);Animation(key,a.getString("path"),a.getInt("width"),a.getInt("height")) },o.optString("answer"),o.nullable("videoPath"))
        documents[id]=result;return result
    }
}

/** Same normalization and explicit chapter/page/key matching as the desktop index. */
class QuestionIndex(private val questions:List<Question>,private val chapters:List<Chapter>) {
    companion object {
        fun normalize(s:String)=Normalizer.normalize(s,Normalizer.Form.NFKC).uppercase().replace(Regex("[－—–]"),"-").replace(Regex("\\s+"),"")
        private fun strip(s:String)=s.trimStart('0').ifEmpty { "0" }
        private fun numeral(s:String)=mapOf("一" to 1,"二" to 2,"三" to 3,"四" to 4,"五" to 5,"六" to 6,"七" to 7,"八" to 8,"九" to 9,"十" to 10)[s]?:s.toIntOrNull()
    }
    fun search(text:String="",chapter:String?=null,page:Int?=null,bookmarks:Set<String>?=null):List<Question> {
        var query=normalize(text);var selectedChapter=chapter;var selectedPage=page
        Regex("第([一二三四五六七八九十]|\\d+)章").find(query)?.let { m->
            val requested="ch"+(numeral(m.groupValues[1])?:-1).toString().padStart(2,'0')
            if(selectedChapter!=null&&selectedChapter!=requested)return emptyList()
            selectedChapter=requested;query=query.replace(m.value,"")
        }
        val pageMatch=Regex("(?:第)?(\\d+)页").find(query)
        pageMatch?.let { m->
            val requested=m.groupValues[1].toIntOrNull()?:return emptyList()
            if(selectedPage!=null&&selectedPage!=requested)return emptyList()
            selectedPage=requested;query=query.replace(m.value,"")
        }
        val questionMatch=Regex("(?:第)?(\\d+(?:-\\d+)*)题").find(query)
        if(questionMatch!=null&&pageMatch!=null)query="P"+strip(pageMatch.groupValues[1])+"-"+questionMatch.groupValues[1].split('-').joinToString("-"){strip(it)}
        if(Regex("^\\d+$").matches(query)) {
            val requested=query.toIntOrNull()?:return emptyList()
            if(selectedPage!=null&&selectedPage!=requested)return emptyList()
            selectedPage=requested;query=""
        }
        val keyMatch=Regex("P?(\\d+(?:-\\d+)+)").find(query)
        val key=keyMatch?.let { "P"+it.groupValues[1].split('-').joinToString("-"){part->strip(part)} }
        if(keyMatch!=null)query=query.replace(keyMatch.value,"")
        return questions.filter { q->
            (selectedChapter==null||q.chapter==selectedChapter)&&(selectedPage==null||q.page==selectedPage)&&(bookmarks==null||q.id in bookmarks)&&
            (key==null||(listOf(q.key)+q.aliases).any { val label=normalize(it);label==key||label.startsWith("$key-") }||
                (q.video&&!keyMatch!!.value.startsWith('P')&&normalize(q.key).let { title->val number=key.drop(1);title.startsWith(number)&&(title.length==number.length||!title[number.length].isDigit()) }))&&
            (query.isEmpty()||normalize(q.key+q.title+q.aliases.joinToString()+chapters.find {it.id==q.chapter}?.title).contains(query))
        }
    }
}
