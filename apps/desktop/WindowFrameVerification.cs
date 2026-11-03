using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.Web.WebView2.WinForms;

namespace DrawingStudio;

// Runs inside this application's own window. It does not drive other apps or
// inject mouse input; the actual OS frame is checked with WM_NCHITTEST.
static class WindowFrameVerification
{
    [StructLayout(LayoutKind.Sequential)]struct NativeRect {public int Left,Top,Right,Bottom;}
    [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr handle,out NativeRect rect);
    [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")]static extern IntPtr GetWindowLongPtr(IntPtr window,int index);
    [DllImport("user32.dll")]static extern IntPtr SendMessage(IntPtr window,int message,IntPtr wParam,IntPtr lParam);

    static object Bounds(Form form)=>new {x=form.Left,y=form.Top,width=form.Width,height=form.Height,clientWidth=form.ClientSize.Width,clientHeight=form.ClientSize.Height};
    static Dictionary<string,int> HitTests(Form window)
    {
        GetWindowRect(window.Handle,out var r);
        var topLeft=window.PointToScreen(Point.Empty);
        var inset=Math.Max(2,Math.Min(topLeft.X-r.Left,topLeft.Y-r.Top)/2);
        int Hit(int x,int y)=>SendMessage(window.Handle,0x84,IntPtr.Zero,(IntPtr)((y&0xffff)<<16|(x&0xffff))).ToInt32();
        return new Dictionary<string,int>{
            ["left"]=Hit(r.Left+inset,(r.Top+r.Bottom)/2),["right"]=Hit(r.Right-inset-1,(r.Top+r.Bottom)/2),
            ["top"]=Hit((r.Left+r.Right)/2,r.Top+inset),["bottom"]=Hit((r.Left+r.Right)/2,r.Bottom-inset-1),
            ["topLeft"]=Hit(r.Left+inset,r.Top+inset),["topRight"]=Hit(r.Right-inset-1,r.Top+inset),
            ["bottomLeft"]=Hit(r.Left+inset,r.Bottom-inset-1),["bottomRight"]=Hit(r.Right-inset-1,r.Bottom-inset-1)};
    }
    static async Task<JsonElement> Viewport(WebView2 browser)
    {
        var encoded=await browser.CoreWebView2.ExecuteScriptAsync("JSON.stringify({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth,title:document.querySelector('h1')?.textContent})");
        return JsonDocument.Parse(JsonSerializer.Deserialize<string>(encoded)!).RootElement.Clone();
    }
    public static async Task<bool> RunAsync(Form window,WebView2 browser)
    {
        var checks=new Dictionary<string,bool>();
        var original=window.Bounds;
        var style=GetWindowLongPtr(window.Handle,-16).ToInt64();
        checks["nativeResizeFrame"]=(style&0x00040000)!=0;
        checks["systemMinimizeMaximize"]=(style&0x00030000)==0x00030000;
        checks["customTitleBarPreserved"]=(style&0x00c00000)==0;
        var studio=(StudioWindow)window;
        checks["lightFrameMatchesPaper"]=studio.VerifyFrameColor(false);
        checks["darkFrameMatchesPaper"]=studio.VerifyFrameColor(true);
        studio.VerifyFrameColor(false);
        var initialHits=HitTests(window);
        var expected=new Dictionary<string,int>{{"left",10},{"right",11},{"top",12},{"bottom",15},{"topLeft",13},{"topRight",14},{"bottomLeft",16},{"bottomRight",17}};
        checks["allEightResizeDirections"]=expected.All(pair=>initialHits[pair.Key]==pair.Value);
        GetWindowRect(window.Handle,out var outer);
        var origin=browser.PointToScreen(Point.Empty);
        checks["webViewCannotCoverNativeBorder"]=origin.X>outer.Left&&origin.Y>outer.Top&&origin.X+browser.Width<outer.Right&&origin.Y+browser.Height<outer.Bottom;
        var initial=Bounds(window);
        window.Size=new Size(Math.Max(window.MinimumSize.Width+80,original.Width-180),Math.Max(window.MinimumSize.Height+40,original.Height-120));
        await Task.Delay(250);
        var resized=Bounds(window);var viewport=await Viewport(browser);
        checks["windowSizeChanges"]=window.Width!=original.Width&&window.Height!=original.Height;
        checks["webViewFollowsClientSize"]=browser.ClientSize==window.ClientSize;
        checks["reactFollowsActualViewport"]=Math.Abs(viewport.GetProperty("width").GetDouble()*viewport.GetProperty("dpr").GetDouble()-browser.ClientSize.Width)<3&&Math.Abs(viewport.GetProperty("height").GetDouble()*viewport.GetProperty("dpr").GetDouble()-browser.ClientSize.Height)<3;
        checks["noHorizontalOverflow"]=!viewport.GetProperty("overflow").GetBoolean();
        window.Size=new Size(200,200);await Task.Delay(100);
        checks["minimumSizeEnforced"]=window.Width>=window.MinimumSize.Width&&window.Height>=window.MinimumSize.Height;
        window.Bounds=original;await Task.Delay(100);
        window.WindowState=FormWindowState.Maximized;await Task.Delay(250);
        var maximized=Bounds(window);var working=Screen.FromControl(window).WorkingArea;
        var client=new Rectangle(window.PointToScreen(Point.Empty),window.ClientSize);
        checks["maximizeWorks"]=window.WindowState==FormWindowState.Maximized;
        checks["maximizeRespectsWorkingArea"]=Math.Abs(client.Left-working.Left)<=2&&Math.Abs(client.Top-working.Top)<=2&&Math.Abs(client.Right-working.Right)<=2&&Math.Abs(client.Bottom-working.Bottom)<=2;
        window.WindowState=FormWindowState.Normal;await Task.Delay(200);
        checks["restoreReturnsOriginalBounds"]=window.Bounds==original;
        var restoredHits=HitTests(window);
        checks["resizeStillWorksAfterRestore"]=expected.All(pair=>restoredHits[pair.Key]==pair.Value);
        var passed=checks.Values.All(value=>value);
        File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"window-frame-verification.json"),JsonSerializer.Serialize(new {
            passed,checks,initialHits,restoredHits,initial,resized,maximized,restored=Bounds(window),viewport,dpi=window.DeviceDpi,
            scope="Application-owned native frame hit tests and actual resize/maximize/restore; no injected mouse drag."},new JsonSerializerOptions{WriteIndented=true}));
        return passed;
    }
}
