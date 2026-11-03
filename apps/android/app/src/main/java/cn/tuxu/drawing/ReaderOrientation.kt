package cn.tuxu.drawing

import android.app.Activity
import android.content.pm.ActivityInfo
import android.view.OrientationEventListener
import androidx.compose.runtime.*
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import kotlinx.coroutines.delay

/** Returning while the phone is still horizontal stays in portrait until the
 * device is upright again. Normal sensor rotation resumes from that position. */
@Composable internal fun OrientationControls(activity:Activity?,immersive:Boolean,dark:Boolean,portraitHeld:Boolean,onUpright:()->Unit) {
    val held by rememberUpdatedState(portraitHeld)
    val upright by rememberUpdatedState(onUpright)
    var lastOrientation by remember {mutableIntStateOf(-1)}
    LaunchedEffect(portraitHeld,lastOrientation) {
        if(portraitHeld&&(lastOrientation in 0..25||lastOrientation in 335..359||lastOrientation in 155..205)) {delay(500);if(held)upright()}
    }
    DisposableEffect(activity) {
        val listener=activity?.let {owner->object:OrientationEventListener(owner) {
            override fun onOrientationChanged(orientation:Int) {
                lastOrientation=orientation
                if(held&&(orientation in 0..25||orientation in 335..359||orientation in 155..205))upright()
            }
        }.also {it.enable()}}
        onDispose {listener?.disable()}
    }
    SideEffect {activity?.let {owner->
        owner.window.navigationBarColor=android.graphics.Color.TRANSPARENT
        if(android.os.Build.VERSION.SDK_INT>=29)owner.window.isNavigationBarContrastEnforced=false
        WindowCompat.getInsetsController(owner.window,owner.window.decorView).apply {
            isAppearanceLightStatusBars=!dark;isAppearanceLightNavigationBars=!dark
            systemBarsBehavior=WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            if(immersive)hide(WindowInsetsCompat.Type.systemBars()) else show(WindowInsetsCompat.Type.systemBars())
        }
    }}
}
internal fun Activity.readerLandscape() {requestedOrientation=ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE}
internal fun Activity.readerPortrait() {requestedOrientation=ActivityInfo.SCREEN_ORIENTATION_PORTRAIT}
internal fun Activity.readerSensor() {requestedOrientation=ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR}
