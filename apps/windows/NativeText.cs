using System;
using System.Collections.Generic;
using System.Drawing;
using System.Runtime.InteropServices;

namespace DrawingReader;

public sealed class TextFont
{
    public string RequestedWindowsFamily { get; set; } = "Times New Roman";
    public int StoredHeightI16 { get; set; } = -13;
    public int WeightRuleForStoredFace { get; set; } = 400;
    public bool ItalicMask2 { get; set; }
    public bool UnderlineMask4 { get; set; }
}
public sealed class TextRun
{
    public string Text { get; set; } = "";
    public TextFont FontRequest { get; set; } = new();
    public int[] Color { get; set; } = [255,255,255];
}
public sealed class TextLine
{
    public int X { get; set; }
    public int Baseline { get; set; }
    public List<TextRun> Runs { get; set; } = [];
}

// The same source is used by offline preview generation and runtime replay.
// Preview PNGs never become the input of the native text renderer.
public static class NativeText
{
    [StructLayout(LayoutKind.Sequential)] struct Size { public int Width,Height; }
    [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] static extern IntPtr CreateFontW(int height,int width,int escapement,int orientation,int weight,uint italic,uint underline,uint strikeout,uint charset,uint output,uint clip,uint quality,uint pitch,string face);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);
    [DllImport("gdi32.dll")] static extern int SaveDC(IntPtr dc);
    [DllImport("gdi32.dll")] static extern bool RestoreDC(IntPtr dc,int saved);
    [DllImport("gdi32.dll")] static extern int SetBkMode(IntPtr dc,int mode);
    [DllImport("gdi32.dll")] static extern uint SetTextAlign(IntPtr dc,uint align);
    [DllImport("gdi32.dll")] static extern uint SetTextColor(IntPtr dc,uint color);
    [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] static extern bool TextOutW(IntPtr dc,int x,int y,string text,int length);
    [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] static extern bool GetTextExtentPoint32W(IntPtr dc,string text,int length,out Size size);
    [DllImport("gdi32.dll")] static extern bool GdiFlush();

    public static void Draw(Graphics graphics,IEnumerable<TextLine> lines,int left,int top,double scale,bool monochrome=false)
    {
        var dc=graphics.GetHdc();var saved=SaveDC(dc);
        try
        {
            SetBkMode(dc,1);SetTextAlign(dc,24);
            foreach(var line in lines)
            {
                var x=(int)Math.Round((line.X-left)*scale);
                var y=(int)Math.Round((line.Baseline-top)*scale);
                foreach(var run in line.Runs)
                {
                    var text=run.Text.Replace("\r","").Replace("\n","");
                    if(text.Length==0)continue;
                    var f=run.FontRequest;
                    var font=CreateFontW((int)Math.Round(f.StoredHeightI16*scale),0,0,0,f.WeightRuleForStoredFace,
                        f.ItalicMask2?1u:0,f.UnderlineMask4?1u:0,0,1,0,0,0,0,f.RequestedWindowsFamily);
                    if(font==IntPtr.Zero)throw new InvalidOperationException("Cannot create diagram font");
                    var old=SelectObject(dc,font);
                    try
                    {
                        SetTextColor(dc,monochrome?0xffffffu:(uint)(run.Color[0]|run.Color[1]<<8|run.Color[2]<<16));
                        if(!TextOutW(dc,x,y,text,text.Length)||!GetTextExtentPoint32W(dc,text,text.Length,out var size))
                            throw new InvalidOperationException("Cannot draw diagram text");
                        x+=size.Width;
                    }
                    finally{SelectObject(dc,old);DeleteObject(font);}
                }
            }
            if(!GdiFlush())throw new InvalidOperationException("Cannot flush diagram text");
        }
        finally{RestoreDC(dc,saved);graphics.ReleaseHdc(dc);}
    }
}
