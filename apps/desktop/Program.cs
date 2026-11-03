using System.Runtime.InteropServices;
using System.Text.Json;
using DrawingReader;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace DrawingStudio;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        try
        {
            var library=Library.ReadAsync(Path.Combine(AppContext.BaseDirectory,"content")).GetAwaiter().GetResult();
            var renderer=new SceneRenderer(library.ContentRoot);
            if(args.Contains("--verify-renderer"))
            {
                var all=SceneVerification.RunAll(library,renderer);
                var vectors=SceneVerification.Run(library,renderer);
                File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"renderer-verification.json"),JsonSerializer.Serialize(new {passed=true,all,vectors}));
                return;
            }
            Application.Run(new StudioWindow(library,renderer,args.Contains("--test"),args.Contains("--verify-window-frame")));
        }
        catch(Exception error)
        {
            File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"startup-error.txt"),error.ToString());
            Environment.ExitCode=1;
        }
    }
}

sealed partial class StudioWindow:Form
{
    WebView2 browser=CreateBrowser();
    readonly Library library;
    readonly SceneRenderer renderer;
    readonly bool test;
    readonly bool brandIconLoaded;
    readonly bool verifyFrame;
    readonly DateTime startupTime=DateTime.UtcNow;
    string activeProfile="";
    bool starting;
    bool firstContentShown;
    bool frameCheckRunning;
    CancellationTokenSource? rendering;
    const string Origin="https://reader.invalid";
    static WebView2 CreateBrowser()=>new(){Dock=DockStyle.Fill,DefaultBackgroundColor=Color.FromArgb(248,247,244)};
    [DllImport("user32.dll")]static extern bool ReleaseCapture();
    [DllImport("user32.dll")]static extern IntPtr SendMessage(IntPtr window,int message,IntPtr wParam,IntPtr lParam);
    [DllImport("dwmapi.dll")]static extern int DwmSetWindowAttribute(IntPtr window,int attribute,ref int value,int size);
    [StructLayout(LayoutKind.Sequential)]struct NativePoint {public int X,Y;}
    [StructLayout(LayoutKind.Sequential)]struct NativeRect {public int Left,Top,Right,Bottom;}
    [StructLayout(LayoutKind.Sequential)]struct MinMaxInfo {public NativePoint Reserved,MaxSize,MaxPosition,MinTrackSize,MaxTrackSize;}
    [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")]static extern IntPtr GetWindowLongPtr(IntPtr window,int index);
    [DllImport("user32.dll")]static extern bool AdjustWindowRectExForDpi(ref NativeRect rect,uint style,bool menu,uint extendedStyle,uint dpi);
    protected override CreateParams CreateParams
    {
        get
        {
            var parameters=base.CreateParams;
            // Keep real non-client resize borders outside the WebView child HWND.
            // The title bar remains drawn by React.
            parameters.Style|=0x00040000|0x00080000|0x00010000|0x00020000;
            return parameters;
        }
    }
    public StudioWindow(Library data,SceneRenderer drawing,bool testing,bool frameVerification=false)
    {
        library=data;renderer=drawing;test=testing;verifyFrame=frameVerification;
        Text="图序 · 工程图学";Size=new Size(1440,960);MinimumSize=new Size(900,640);
        using(var iconStream=typeof(StudioWindow).Assembly.GetManifestResourceStream("DrawingStudio.AppIcon"))
            if(iconStream is not null){Icon=new Icon(iconStream,32,32);brandIconLoaded=true;}
        StartPosition=FormStartPosition.CenterScreen;FormBorderStyle=FormBorderStyle.None;
        Controls.Add(browser);Shown+=async(_,_)=>await StartAsync();
        FormClosed+=(_,_)=>{rendering?.Cancel();browser.Dispose();Icon?.Dispose();};
    }
    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);var corners=2;DwmSetWindowAttribute(Handle,33,ref corners,4);
        UpdateFrameTheme(false);
    }
    protected override void WndProc(ref Message m)
    {
        if(PaintFrameMessage(ref m))return;
        base.WndProc(ref m);
        if(m.Msg==0x24&&IsHandleCreated)
        {
            var monitor=Screen.FromHandle(m.HWnd);var working=monitor.WorkingArea;
            var frame=new NativeRect();
            AdjustWindowRectExForDpi(ref frame,(uint)GetWindowLongPtr(m.HWnd,-16).ToInt64(),false,(uint)GetWindowLongPtr(m.HWnd,-20).ToInt64(),(uint)DeviceDpi);
            var limits=Marshal.PtrToStructure<MinMaxInfo>(m.LParam);
            limits.MaxPosition.X=working.Left-monitor.Bounds.Left+frame.Left;
            limits.MaxPosition.Y=working.Top-monitor.Bounds.Top+frame.Top;
            limits.MaxSize.X=working.Width+frame.Right-frame.Left;
            limits.MaxSize.Y=working.Height+frame.Bottom-frame.Top;
            Marshal.StructureToPtr(limits,m.LParam,false);m.Result=IntPtr.Zero;return;
        }
        if(m.Msg!=0x84||WindowState==FormWindowState.Maximized)return;
        if(m.Result.ToInt64() is >=10 and <=17)return;
        var raw=m.LParam.ToInt64();var p=PointToClient(new Point((short)(raw&0xffff),(short)((raw>>16)&0xffff)));
        var edge=Math.Max(7,(int)Math.Round(7*DeviceDpi/96.0));bool left=p.X<edge,right=p.X>=ClientSize.Width-edge,top=p.Y<edge,bottom=p.Y>=ClientSize.Height-edge;
        var hit=top&&left?13:top&&right?14:bottom&&left?16:bottom&&right?17:left?10:right?11:top?12:bottom?15:0;
        if(hit!=0)m.Result=(IntPtr)hit;
    }
    async Task StartAsync()
    {
        if(starting||IsDisposed)return;
        starting=true;
        firstContentShown=false;
        var failures=new List<string>();
        try
        {
            var profiles=test?new[]{Path.Combine(AppContext.BaseDirectory,"test-profile")}:new[]{
                Path.Combine(AppContext.BaseDirectory,"user-data","WebView"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"DrawingStudio","WebView"),
                Path.Combine(Path.GetTempPath(),"DrawingStudio",Environment.UserName,"WebView")};
            foreach(var profile in profiles.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                try
                {
                    activeProfile=Path.GetFullPath(profile);WriteStartupStatus("creating-profile");
                    Directory.CreateDirectory(activeProfile);
                    using(var probe=new FileStream(Path.Combine(activeProfile,".write-test-"+Guid.NewGuid().ToString("N")),FileMode.CreateNew,FileAccess.ReadWrite,FileShare.None,1,FileOptions.DeleteOnClose))probe.WriteByte(1);
                    if(browser.IsDisposed){browser=CreateBrowser();Controls.Add(browser);}
                    var options=new CoreWebView2EnvironmentOptions(test?"--remote-debugging-port=9337 --remote-allow-origins=http://127.0.0.1:9337":"");
                    WriteStartupStatus("creating-environment");
                    var environment=await CoreWebView2Environment.CreateAsync(null,activeProfile,options);
                    if(IsDisposed)return;
                    activeProfile=environment.UserDataFolder;WriteStartupStatus("creating-controller");
                    await browser.EnsureCoreWebView2Async(environment);
                    break;
                }
                catch(Exception error)
                {
                    failures.Add(activeProfile+Environment.NewLine+error);Controls.Remove(browser);browser.Dispose();
                }
            }
            if(IsDisposed)return;
            if(browser.IsDisposed||browser.CoreWebView2 is null)throw new InvalidOperationException(string.Join(Environment.NewLine+Environment.NewLine,failures));
            browser.CoreWebView2.SetVirtualHostNameToFolderMapping("reader.invalid",AppContext.BaseDirectory,CoreWebView2HostResourceAccessKind.Deny);
            browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled=false;
            browser.CoreWebView2.Settings.IsStatusBarEnabled=false;
            browser.CoreWebView2.Settings.AreDevToolsEnabled=test;
            browser.CoreWebView2.Settings.IsZoomControlEnabled=false;
            browser.CoreWebView2.NavigationStarting+=(_,e)=>{if(!e.Uri.StartsWith(Origin+"/",StringComparison.Ordinal))e.Cancel=true;};
            browser.CoreWebView2.NewWindowRequested+=(_,e)=>e.Handled=true;
            browser.CoreWebView2.WebMessageReceived+=MessageReceived;
            browser.CoreWebView2.NavigationCompleted+=(_,e)=>{if(e.IsSuccess){if(!firstContentShown)WriteStartupStatus("ui-loaded");}else ShowStartupFailure(new InvalidOperationException("界面文件未加载："+e.WebErrorStatus));};
            browser.Source=new Uri(Origin+"/ui/index.html"+(test?"?test=1":""));
        }
        catch(Exception error){ShowStartupFailure(error);}
        finally{starting=false;}
    }
    void WriteStartupStatus(string phase)
    {
        try{File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"startup-status.json"),JsonSerializer.Serialize(new {
            phase,startedUtc=startupTime,updatedUtc=DateTime.UtcNow,pid=Environment.ProcessId,profile=activeProfile,
            testMode=test,debugPortEnabled=test,frames=library.Frames.Count,
            brandIconLoaded,windowIconSize=brandIconLoaded&&Icon is {} actualIcon?new[]{actualIcon.Width,actualIcon.Height}:null}));}catch{}
    }
    void ShowStartupFailure(Exception error)
    {
        if(IsDisposed)return;
        WriteStartupStatus("failed");
        try{File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"startup-error.txt"),error.ToString());}catch{}
        rendering?.Cancel();Controls.Clear();browser.Dispose();FormBorderStyle=FormBorderStyle.Sizable;
        var panel=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,Padding=new Padding(32),BackColor=Color.FromArgb(248,247,244)};
        panel.Controls.Add(new Label{Text="图序暂未打开",AutoSize=true,Font=new Font("Microsoft YaHei UI",20)});
        panel.Controls.Add(new Label{Text="界面初始化没有完成，程序已保留此窗口。可以重试或查看启动日志。",AutoSize=true,Margin=new Padding(0,20,0,20)});
        var retry=new Button{Text="重新打开",AutoSize=true};
        retry.Click+=async(_,_)=>{panel.Dispose();Controls.Clear();FormBorderStyle=FormBorderStyle.None;await StartAsync();};
        var logs=new Button{Text="查看启动日志",AutoSize=true};
        logs.Click+=(_,_)=>{var path=Path.Combine(AppContext.BaseDirectory,"startup-error.txt");if(File.Exists(path))System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(path){UseShellExecute=true});};
        panel.Controls.Add(retry);panel.Controls.Add(logs);Controls.Add(panel);
    }
    async void MessageReceived(object? sender,CoreWebView2WebMessageReceivedEventArgs e)
    {
        if(!e.Source.StartsWith(Origin+"/",StringComparison.Ordinal))return;
        string? id=null;
        try
        {
            using var json=JsonDocument.Parse(e.WebMessageAsJson);var message=json.RootElement;
            id=message.GetProperty("id").GetString();var type=message.GetProperty("type").GetString();
            if(type=="render")
            {
                var fid=message.GetProperty("frame").GetString()!;
                if(!library.Frames.TryGetValue(fid,out var frame)||frame.Scene is null)throw new InvalidDataException("绘图场景不存在");
                var scale=message.GetProperty("scale").GetDouble();
                if(!double.IsFinite(scale))throw new InvalidDataException("缩放比例无效");
                rendering?.Cancel();var cancellation=rendering=new CancellationTokenSource();
                var result=await Task.Run(()=>renderer.Render(frame.Scene,scale,cancellation.Token));
                if(cancellation.IsCancellationRequested)throw new OperationCanceledException();
                Reply(id,new {png=Convert.ToBase64String(result.Png),width=result.PixelWidth,height=result.PixelHeight,scale=result.Scale});
            }
            else if(type=="window")
            {
                switch(message.GetProperty("action").GetString())
                {
                    case "minimize":WindowState=FormWindowState.Minimized;break;
                    case "maximize":WindowState=WindowState==FormWindowState.Maximized?FormWindowState.Normal:FormWindowState.Maximized;break;
                    case "drag":ReleaseCapture();SendMessage(Handle,0xA1,(IntPtr)2,IntPtr.Zero);break;
                    case "close":Close();return;
                }
                Reply(id,new {ok=true});
            }
            else if(type=="theme")
            {
                UpdateFrameTheme(message.GetProperty("dark").GetBoolean());
                Reply(id,new {ok=true});
            }
            else if(type=="ping")Reply(id,new {ok=true,engine="source-scene-replay",winui=false,frames=library.Frames.Count});
            else if(type=="startupReady")
            {
                firstContentShown=true;
                WriteStartupStatus("ready");
                try{var path=Path.Combine(AppContext.BaseDirectory,"startup-error.txt");if(File.Exists(path)){File.Copy(path,Path.Combine(AppContext.BaseDirectory,"previous-startup-error.txt"),true);File.Delete(path);}}catch{}
                Reply(id,new {ok=true});
                if(verifyFrame&&!frameCheckRunning)
                {
                    frameCheckRunning=true;
                    BeginInvoke(new Action(async()=>
                    {
                        try{if(!await WindowFrameVerification.RunAsync(this,browser))Environment.ExitCode=1;}
                        catch(Exception error){File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"window-frame-error.txt"),error.ToString());Environment.ExitCode=1;}
                        finally{Close();}
                    }));
                }
            }
            else if(type=="openVideo")
            {
                var question=library.Questions.Single(q=>q.Id==message.GetProperty("question").GetString());
                if(question.VideoPath is null)throw new InvalidDataException("此题没有原视频");
                var path=Path.GetFullPath(Path.Combine(library.ContentRoot,question.VideoPath));
                if(!path.StartsWith(library.ContentRoot+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("视频路径无效");
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(path){UseShellExecute=true});
                Reply(id,new {ok=true});
            }
            else throw new InvalidDataException("未知请求");
        }
        catch(OperationCanceledException){Reply(id,null,"cancelled");}
        catch(Exception error){Reply(id,null,error.Message);}
    }
    void Reply(string? id,object? result,string? error=null)
    {
        if(!IsDisposed&&browser.CoreWebView2 is not null)
            browser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new {id,result,error}));
    }
}
