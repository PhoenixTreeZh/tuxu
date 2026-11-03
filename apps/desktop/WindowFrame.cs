using System.Runtime.InteropServices;

namespace DrawingStudio;

sealed partial class StudioWindow
{
    Color frameColor=Color.FromArgb(248,247,244);
    [DllImport("user32.dll")]static extern IntPtr GetWindowDC(IntPtr window);
    [DllImport("user32.dll")]static extern int ReleaseDC(IntPtr window,IntPtr dc);
    [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr window,out NativeRect rect);
    [DllImport("user32.dll")]static extern bool RedrawWindow(IntPtr window,IntPtr rect,IntPtr region,uint flags);
    [DllImport("gdi32.dll")]static extern uint GetPixel(IntPtr dc,int x,int y);

    void UpdateFrameTheme(bool dark)
    {
        frameColor=dark?Color.FromArgb(28,34,32):Color.FromArgb(248,247,244);
        BackColor=frameColor;
        if(!IsHandleCreated)return;
        // Windows 11's accent border is independent of the resize frame.
        var noBorder=unchecked((int)0xfffffffe);
        DwmSetWindowAttribute(Handle,34,ref noBorder,4);
        RedrawWindow(Handle,IntPtr.Zero,IntPtr.Zero,0x401);
        PaintResizeFrame();
    }
    bool PaintFrameMessage(ref Message message)
    {
        if(message.Msg==0x85&&IsHandleCreated)
        {
            PaintResizeFrame();message.Result=IntPtr.Zero;return true;
        }
        if(message.Msg==0x86&&IsHandleCreated)
        {
            // Avoid DefWindowProc painting the default white non-client strip
            // on activation. The real WS_THICKFRAME still owns all resize hits.
            PaintResizeFrame();message.Result=(IntPtr)1;return true;
        }
        return false;
    }
    void PaintResizeFrame()
    {
        if(!IsHandleCreated||WindowState==FormWindowState.Minimized)return;
        GetWindowRect(Handle,out var outer);
        var origin=PointToScreen(Point.Empty);
        var client=new Rectangle(origin.X-outer.Left,origin.Y-outer.Top,ClientSize.Width,ClientSize.Height);
        var dc=GetWindowDC(Handle);
        if(dc==IntPtr.Zero)return;
        try
        {
            using var graphics=Graphics.FromHdc(dc);
            graphics.ExcludeClip(client);
            using var brush=new SolidBrush(frameColor);
            graphics.FillRectangle(brush,0,0,outer.Right-outer.Left,outer.Bottom-outer.Top);
        }
        finally{ReleaseDC(Handle,dc);}
    }
    internal bool VerifyFrameColor(bool dark)
    {
        UpdateFrameTheme(dark);
        var origin=PointToScreen(Point.Empty);GetWindowRect(Handle,out var r);
        var thickness=origin.Y-r.Top;
        if(thickness<1)return false;
        var dc=GetWindowDC(Handle);
        try
        {
            var expected=(uint)(frameColor.R|frameColor.G<<8|frameColor.B<<16);
            return Enumerable.Range(1,Math.Max(1,thickness-1)).All(y=>GetPixel(dc,(r.Right-r.Left)/2,y)==expected);
        }
        finally{ReleaseDC(Handle,dc);}
    }
}
