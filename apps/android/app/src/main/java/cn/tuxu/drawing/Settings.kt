package cn.tuxu.drawing

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlin.math.cos
import kotlin.math.sin

@Composable internal fun ReaderIcon(name:String,color:Color=LocalPalette.current.ink) {
    Canvas(Modifier.size(22.dp)) {
        val unit=size.width/24f;val stroke=Stroke(1.7f*unit)
        if(name=="settings") {
            val path=Path()
            for(i in 0 until 64) {
                val angle=i*Math.PI/32;val radius=if(i%8 in 2..5)10f else 7.6f
                val x=(12f+cos(angle).toFloat()*radius)*unit;val y=(12f+sin(angle).toFloat()*radius)*unit
                if(i==0)path.moveTo(x,y) else path.lineTo(x,y)
            }
            path.close();drawPath(path,color,style=stroke);drawCircle(color,3f*unit,Offset(12f*unit,12f*unit),style=stroke)
        } else {
            val path=Path().apply {moveTo(11f*unit,5f*unit);lineTo(4f*unit,12f*unit);lineTo(11f*unit,19f*unit);moveTo(4f*unit,12f*unit);lineTo(21f*unit,12f*unit)}
            drawPath(path,color,style=stroke)
        }
    }
}
@Composable internal fun ReaderIconButton(name:String,label:String,onClick:()->Unit,tag:String) {
    IconButton(onClick,Modifier.size(48.dp).testTag(tag).semantics {contentDescription=label}) {Box(Modifier){ReaderIcon(name)}}
    // IconButton's semantic description is supplied independently of its shape.
}
@Composable internal fun SettingsPage(reader:Reader,page:String,onPage:(String)->Unit,onBack:()->Unit) {
    val p=LocalPalette.current
    var support by remember {mutableStateOf(false)}
    Column(Modifier.fillMaxSize().testTag("settings-page")) {
        Row(Modifier.fillMaxWidth().height(64.dp).padding(horizontal=8.dp),verticalAlignment=Alignment.CenterVertically) {
            ReaderIconButton("back","返回",onBack,"settings-back")
            Text(if(page=="appearance")"外观" else "设置",color=p.ink,fontSize=22.sp,fontWeight=FontWeight.Medium)
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal=20.dp,vertical=16.dp),verticalArrangement=Arrangement.spacedBy(20.dp)) {
            if(page=="appearance") {
                Surface(color=p.surface,shape=RoundedCornerShape(16.dp)) {
                    Column {
                        listOf(Appearance.DARK,Appearance.LIGHT,Appearance.SYSTEM).forEach {appearance->
                            Row(Modifier.fillMaxWidth().selectable(reader.appearance==appearance,onClick={reader.appearance(appearance)},role=Role.RadioButton).testTag("appearance:${appearance.name}").padding(horizontal=16.dp,vertical=12.dp),verticalAlignment=Alignment.CenterVertically) {
                                Text(appearance.label,Modifier.weight(1f),fontSize=16.sp,color=p.ink)
                                RadioButton(reader.appearance==appearance,onClick=null)
                            }
                        }
                    }
                }
            } else {
                SettingsEntry("外观",reader.appearance.label,"appearance-entry"){onPage("appearance")}
                SettingsEntry("支持我",null,"support-entry"){support=true}
                Column(Modifier.fillMaxWidth().padding(top=12.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(6.dp)) {
                    Text("图序 ${BuildConfig.VERSION_NAME} · PhoenixTree",fontSize=12.sp,color=p.muted)
                    Text("离线工程图学习题阅读器",fontSize=12.sp,color=p.muted)
                    Text("问题反馈与建议",fontSize=12.sp,color=p.muted)
                    SelectionContainer {Text("phoenixtree_zh@163.com",fontSize=12.sp,color=p.muted)}
                }
            }
        }
    }
    if(support) {
        val maxHeight=(LocalConfiguration.current.screenHeightDp-96).coerceAtLeast(160).dp
        Dialog(onDismissRequest={support=false},properties=DialogProperties(usePlatformDefaultWidth=false)) {
            Surface(Modifier.widthIn(max=420.dp).fillMaxWidth().padding(24.dp),shape=RoundedCornerShape(20.dp),color=p.surface) {
                Column(Modifier.heightIn(max=maxHeight).verticalScroll(rememberScrollState()).padding(20.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
                    Text("支持我",fontSize=20.sp,fontWeight=FontWeight.Medium,color=p.ink)
                    Image(painterResource(R.drawable.support_payment),"PhoenixTree 的微信收款码",Modifier.fillMaxWidth().heightIn(max=maxHeight-120.dp).testTag("support-qr"),contentScale=ContentScale.Fit)
                    Action("关闭",{support=false},Modifier.fillMaxWidth().testTag("support-close"))
                }
            }
        }
    }
}
@Composable private fun SettingsEntry(title:String,subtitle:String?,tag:String,onClick:()->Unit) {
    val p=LocalPalette.current
    Surface(color=p.surface,shape=RoundedCornerShape(16.dp),modifier=Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).clickable(onClick=onClick).testTag(tag)) {
        Row(Modifier.padding(horizontal=20.dp,vertical=20.dp),verticalAlignment=Alignment.CenterVertically) {
            Text(title,Modifier.weight(1f),fontSize=16.sp,color=p.ink)
            if(subtitle!=null)Text(subtitle,Modifier.padding(end=12.dp),fontSize=13.sp,color=p.muted)
            Text("›",fontSize=22.sp,color=p.muted)
        }
    }
}
