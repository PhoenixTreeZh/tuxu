package cn.tuxu.drawing

import org.junit.Assert.*
import org.junit.Test

class QuestionIndexTest {
    private fun q(id:String,page:Int,key:String,chapter:String="ch01",aliases:List<String> = emptyList())=Question(id,chapter,page,key,key,aliases,0,false,0,"")
    private val questions=listOf(q("first",2,"P2-1"),q("two",2,"P2-2"),q("detail",43,"P43-1","ch06",listOf("P43-1-2")),q("other",43,"P43-2","ch06"),q("same-page",43,"P43-1","ch07"))
    private val index=QuestionIndex(questions,listOf(Chapter("ch01","第一章"),Chapter("ch06","第六章"),Chapter("ch07","第七章")))
    @Test fun fullWidthAndLeadingZerosResolve(){assertEquals(listOf("first"),index.search("Ｐ００２－０１").map {it.id})}
    @Test fun chineseChapterPageAndQuestionDisambiguate(){assertEquals(listOf("detail"),index.search("第六章 第43页 第1题").map {it.id})}
    @Test fun aliasStaysUnderItsMainQuestion(){assertEquals(listOf("detail"),index.search("P43-1-2").map {it.id})}
    @Test fun pageSearchRetainsOrder(){assertEquals(listOf("detail","other","same-page"),index.search("43页").map {it.id})}
    @Test fun contradictoryFiltersReturnNothing(){assertTrue(index.search("第六章 43页",chapter="ch01").isEmpty());assertTrue(index.search("43页",page=2).isEmpty())}
    @Test fun bookmarkAndChapterFiltersIntersect(){assertEquals(listOf("detail"),index.search(chapter="ch06",bookmarks=setOf("first","detail")).map {it.id})}
    @Test fun oversizedPageNumberDoesNotCrash(){assertTrue(index.search("9999999999999999999999页").isEmpty())}
}
