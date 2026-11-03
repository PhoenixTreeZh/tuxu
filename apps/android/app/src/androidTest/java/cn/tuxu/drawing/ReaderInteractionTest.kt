package cn.tuxu.drawing

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.graphics.Bitmap
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ReaderInteractionTest {
    @get:Rule val rule=createAndroidComposeRule<MainActivity>()
    @Before fun portrait() {
        rule.runOnUiThread {rule.activity.readerPortrait()}
        rule.waitUntil(15000){rule.onAllNodesWithTag("settings").fetchSemanticsNodes().isNotEmpty()&&drawing()?.displayedId!=null}
    }
    private fun findDrawing(view:View):DrawingView? {
        if(view is DrawingView)return view
        if(view is ViewGroup)for(i in 0 until view.childCount)findDrawing(view.getChildAt(i))?.let {return it}
        return null
    }
    private fun drawing()=findDrawing(rule.activity.window.decorView)
    private fun ready() {rule.waitUntil(15000){drawing()?.let {it.displayedId!=null&&it.displayedId==it.frame?.id}==true}}
    private fun clearFilter() {
        rule.onNodeWithTag("library").performClick();rule.onNodeWithTag("search").performTextClearance()
        rule.runOnUiThread {rule.activity.onBackPressedDispatcher.onBackPressed()}
        rule.waitUntil(10000){rule.onAllNodesWithTag("search").fetchSemanticsNodes().isEmpty()}
    }
    private fun open(id:String,clear:Boolean=false) {
        rule.onNodeWithTag("library").performClick()
        rule.onNodeWithTag("search").performTextReplacement(id.substringAfter('/'))
        rule.onNodeWithTag("question:$id").performScrollTo().performClick()
        rule.waitUntil(15000){rule.onAllNodes(hasText(id.substringAfter('/')) and hasTestTag("question-title")).fetchSemanticsNodes().isNotEmpty()}
        ready();if(clear)clearFilter()
    }
    private fun appearance(value:Appearance) {
        rule.onNodeWithTag("settings").performClick();rule.onNodeWithTag("appearance-entry").performClick()
        rule.onNodeWithTag("appearance:${value.name}").performClick().assertIsSelected()
        rule.onNodeWithTag("settings-back").performClick();rule.onNodeWithTag("settings-back").performClick()
    }
    private fun rootTheme(value:String)=rule.onNodeWithTag("reader-root").assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription,value))
    private fun shell(command:String) {android.os.ParcelFileDescriptor.AutoCloseInputStream(InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand(command)).use {it.readBytes()}}
    private fun screenshot(name:String) {
        if(rule.onAllNodesWithTag("settings-page").fetchSemanticsNodes().isEmpty())ready()
        rule.waitForIdle();Thread.sleep(500);InstrumentationRegistry.getInstrumentation().waitForIdleSync()
        val bitmap=InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
        InstrumentationRegistry.getInstrumentation().targetContext.filesDir.resolve(name).outputStream().use {bitmap.compress(Bitmap.CompressFormat.PNG,100,it)};bitmap.recycle()
    }
    @Test fun settingsAppearanceAndOriginalPaymentQr() {
        open("ch06/P43-1")
        rule.onNodeWithTag("settings").performClick()
        rule.onNodeWithText("图序 1.1.0 · PhoenixTree").assertExists()
        rule.onNodeWithText("phoenixtree_zh@163.com").assertExists()
        rule.onNodeWithTag("appearance-entry").performClick()
        rule.onNodeWithTag("appearance:DARK").performClick().assertIsSelected();rootTheme("深色")
        rule.onNodeWithTag("appearance:LIGHT").performClick().assertIsSelected();rootTheme("浅色")
        rule.onNodeWithTag("appearance:SYSTEM").performClick().assertIsSelected()
        shell("cmd uimode night yes");rule.waitUntil(10000){rule.onNodeWithTag("reader-root").fetchSemanticsNode().config[SemanticsProperties.StateDescription]=="深色"}
        shell("cmd uimode night no");rule.waitUntil(10000){rule.onNodeWithTag("reader-root").fetchSemanticsNode().config[SemanticsProperties.StateDescription]=="浅色"}
        screenshot("android-appearance.png")
        rule.onNodeWithTag("settings-back").performClick();screenshot("android-settings.png")
        rule.onNodeWithTag("support-entry").performClick()
        rule.onNodeWithTag("support-qr").assertExists();screenshot("android-support.png")
        rule.onNodeWithTag("support-close").performClick();rule.onNodeWithTag("settings-back").performClick()
        appearance(Appearance.DARK);screenshot("android-dark.png")
        appearance(Appearance.LIGHT);screenshot("android-light.png")
        rule.onNodeWithTag("redraw").assertDoesNotExist()
    }
    @Test fun navigationMergesWithoutMovingAndShowsFilteredBoundaries() {
        open("ch01/P2-1")
        val firstPrevious=rule.onNodeWithTag("previous-question").fetchSemanticsNode().boundsInWindow
        val firstNext=rule.onNodeWithTag("next-step").fetchSemanticsNode().boundsInWindow
        assertTrue(firstPrevious.width>firstNext.width*1.9f)
        rule.onNodeWithTag("previous-step").assertDoesNotExist()
        rule.onNodeWithTag("previous-question").performClick()
        rule.onNodeWithTag("navigation-notice").assertTextContains("已到当前筛选的第一题",substring=true)
        val layouts=mutableListOf<TextLayoutResult>()
        rule.onNodeWithText("下一步",useUnmergedTree=true).performSemanticsAction(SemanticsActions.GetTextLayoutResult){it(layouts)}
        screenshot("android-step-controls.png")
        assertTrue(layouts.isNotEmpty())
        val label=layouts.first()
        assertEquals("All three characters must fit on the visible line",3,label.getLineEnd(0,visibleEnd=true))
        assertFalse(label.isLineEllipsized(0))
        assertTrue("Last character exceeds button",label.getBoundingBox(2).right<=firstNext.width-8f)
        rule.onNodeWithTag("next-step").performClick();rule.onNodeWithTag("step-label").assertTextEquals("2 / 11")
        val middlePrevious=rule.onNodeWithTag("previous-question").fetchSemanticsNode().boundsInWindow
        assertTrue(firstPrevious.width>middlePrevious.width*1.9f)
        assertEquals(firstNext.top,middlePrevious.top,1f)
        repeat(9){rule.onNodeWithTag("next-step").performClick()}
        rule.onNodeWithTag("step-label").assertTextEquals("11 / 11")
        rule.onNodeWithTag("next-step").assertDoesNotExist()
        val lastNext=rule.onNodeWithTag("next-question").fetchSemanticsNode().boundsInWindow
        assertTrue(lastNext.width>firstNext.width*1.9f);assertEquals(firstNext.top,lastNext.top,1f)
        rule.onNodeWithTag("next-question").performClick()
        rule.onNodeWithTag("navigation-notice").assertTextContains("已到当前筛选的最后一题",substring=true)
        clearFilter()
        // The left part of the merged button is the previous next-step position.
        rule.onNodeWithTag("next-question").performTouchInput {click(Offset(width*.25f,height/2f))}
        rule.waitUntil(15000){rule.onAllNodes(hasTestTag("question-title") and hasText("P2-2")).fetchSemanticsNodes().isNotEmpty()}
        assertEquals(firstNext.top,rule.onNodeWithTag("next-question").fetchSemanticsNode().boundsInWindow.top,1f)
        open("ch06/P43-1")
        assertEquals(firstNext.top,rule.onNodeWithTag("next-question").fetchSemanticsNode().boundsInWindow.top,1f)
        rule.onNodeWithTag("clickable-hint").assertTextEquals("点击图上区域查看细节")
        rule.onNodeWithTag("source-info").performClick()
        rule.onNodeWithText("资料说明").assertExists();rule.onNodeWithText("知道了").performClick()
        assertEquals(firstNext.top,rule.onNodeWithTag("next-question").fetchSemanticsNode().boundsInWindow.top,1f)
    }
    @Test fun fullscreenFitsAndKeepsGesturesAndPictureHotspots() {
        open("ch06/P43-1",clear=true)
        rule.onNodeWithTag("enter-fullscreen").performClick()
        fullReady()
        rule.onNodeWithTag("fullscreen-question-title").assertTextEquals("P43-1")
        assertFits()
        val previous=rule.onNodeWithTag("previous-question").fetchSemanticsNode().boundsInWindow
        val next=rule.onNodeWithTag("next-question").fetchSemanticsNode().boundsInWindow
        assertEquals(previous.height,next.height,1f)
        rule.onNodeWithTag("previous-step").assertDoesNotExist();rule.onNodeWithTag("next-step").assertDoesNotExist()
        screenshot("android-landscape.png")
        val rootId=drawing()!!.frame!!.id
        val hotspot=drawing()!!.frame!!.hotspots.first {it.kind=="detail"}
        val point=rule.runOnUiThread {
            val view=drawing()!!;val painted=view.visibleContentRect();val source=view.contentSourceRect();val f=view.frame!!
            val scale=painted.width()/source.width()
            Offset(painted.left+((hotspot.rect[0]+hotspot.rect[2])/2-f.viewport[0]-source.left)*scale,painted.top+((hotspot.rect[1]+hotspot.rect[3])/2-f.viewport[1]-source.top)*scale)
        }
        rule.onNodeWithTag("drawing-canvas").performTouchInput {click(point)}
        rule.waitUntil(10000){drawing()?.displayedId==hotspot.frame}
        rule.onNodeWithTag("back-detail-fullscreen").performClick();rule.waitUntil(10000){drawing()?.displayedId==rootId}
        rule.onNodeWithTag("drawing-canvas").performTouchInput {swipe(center,center+Offset(80f,35f))}
        assertTrue(drawing()!!.camera.x!=0f)
        rule.onNodeWithTag("fit-fullscreen").performClick();assertFits()
        rule.onNodeWithTag("drawing-canvas").performTouchInput {pinch(center-Offset(width*.12f,0f),center-Offset(width*.36f,0f),center+Offset(width*.12f,0f),center+Offset(width*.36f,0f))}
        assertNotNull(drawing()!!.camera.zoom)
        rule.onNodeWithTag("exit-fullscreen").performClick()
        rule.waitUntil(10000){rule.activity.resources.configuration.orientation==Configuration.ORIENTATION_PORTRAIT&&rule.onAllNodesWithTag("settings").fetchSemanticsNodes().isNotEmpty()}
    }
    @Test fun sensorLandscapeUsesSameMergedControlPage() {
        open("ch01/P2-1",clear=true)
        rule.runOnUiThread {rule.activity.requestedOrientation=ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE}
        fullReady();assertFits()
        val previous=rule.onNodeWithTag("previous-question").fetchSemanticsNode().boundsInWindow
        val step=rule.onNodeWithTag("next-step").fetchSemanticsNode().boundsInWindow
        assertTrue(previous.height>step.height*1.9f)
        assertTrue(step.left>rule.onNodeWithTag("drawing-canvas").fetchSemanticsNode().boundsInWindow.right)
        val framing=drawing()!!.visibleContentRect()
        rule.onNodeWithTag("next-step").performClick()
        ready();rule.waitForIdle()
        val nextFraming=drawing()!!.visibleContentRect()
        assertEquals(framing.left,nextFraming.left,1f);assertEquals(framing.top,nextFraming.top,1f)
        assertEquals(framing.width(),nextFraming.width(),1f);assertEquals(framing.height(),nextFraming.height(),1f)
        assertEquals(step.top,rule.onNodeWithTag("next-step").fetchSemanticsNode().boundsInWindow.top,1f)
        rule.onNodeWithTag("exit-fullscreen").performClick()
    }
    private fun fullReady() {
        rule.waitUntil(10000){rule.activity.resources.configuration.orientation==Configuration.ORIENTATION_LANDSCAPE&&rule.onAllNodesWithTag("fullscreen-reader").fetchSemanticsNodes().isNotEmpty()}
        ready();rule.waitForIdle()
        rule.waitUntil(10000){drawing()?.fitContent==true&&drawing()!!.height>100}
    }
    private fun assertFits() {
        rule.waitForIdle()
        rule.runOnUiThread {
            val view=drawing()!!;val rect=view.visibleContentRect()
            assertTrue("Drawing left clipped",rect.left>=-1f);assertTrue("Drawing top clipped",rect.top>=-1f)
            assertTrue("Drawing right clipped",rect.right<=view.width+1f);assertTrue("Drawing bottom clipped",rect.bottom<=view.height+1f)
            assertTrue("Drawing not maximized",rect.width()/view.width>.88f||rect.height()/view.height>.88f)
        }
    }
}
