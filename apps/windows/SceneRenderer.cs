using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace DrawingReader;

public sealed class DrawingScene
{
    public int Version { get; set; }
    public int[] Viewport { get; set; } = [];
    public List<SceneOperation> Operations { get; set; } = [];
    public bool ContainsVectorContent { get; set; }
    public int VectorAssetCount { get; set; }
    public int RasterAssetCount { get; set; }
    public int GeometryCount { get; set; }
    public int TextCount { get; set; }
}
public sealed class SceneOperation
{
    public string Kind { get; set; } = "";
    public string? Path { get; set; }
    public string? Sha256 { get; set; }
    public int[] Rect { get; set; } = [];
    public int[][] Points { get; set; } = [];
    public int[] Color { get; set; } = [0,0,0];
    public int PenWidth { get; set; } = 1;
    public List<TextLine> Lines { get; set; } = [];
    public int[]? BackgroundColor { get; set; }
    public bool FillBackground { get; set; }
}
public sealed record SceneRenderResult(byte[] Png,int PixelWidth,int PixelHeight,double Scale,int VectorAssets,int Geometry,int RasterAssets);

// A screen-resolution buffer is a presentation surface, not the source of the
// next redraw. Every render starts again from retained WMF and geometry.
public sealed class SceneRenderer
{
    readonly string contentRoot;
    readonly HashSet<string> verified = [];
    readonly object renderLock = new();
    public int RenderCount { get; private set; }
    public SceneRenderer(string directory) => contentRoot=System.IO.Path.GetFullPath(directory);
    public SceneRenderResult Render(DrawingScene scene,double requestedScale,CancellationToken cancellation)
    {
        lock(renderLock)return RenderCore(scene,requestedScale,cancellation);
    }
    SceneRenderResult RenderCore(DrawingScene scene,double requestedScale,CancellationToken cancellation)
    {
        cancellation.ThrowIfCancellationRequested();
        var scale=Math.Clamp(requestedScale,.1,16);
        var width=scene.Viewport[2]-scene.Viewport[0];
        var height=scene.Viewport[3]-scene.Viewport[1];
        if(width<=0||height<=0)throw new InvalidDataException("Invalid scene viewport");
        scale=Math.Min(scale,Math.Sqrt(32_000_000.0/width/height));
        var pixelWidth=Math.Max(1,(int)Math.Ceiling(width*scale));
        var pixelHeight=Math.Max(1,(int)Math.Ceiling(height*scale));
        using var bitmap=new Bitmap(pixelWidth,pixelHeight,PixelFormat.Format24bppRgb);
        using var graphics=Graphics.FromImage(bitmap);
        graphics.PageUnit=GraphicsUnit.Pixel;graphics.Clear(System.Drawing.Color.Black);
        graphics.SmoothingMode=SmoothingMode.None;
        foreach(var operation in scene.Operations)
        {
            cancellation.ThrowIfCancellationRequested();
            if(operation.Kind is "metafile" or "bitmap")
            {
                var path=Resolve(operation.Path??throw new InvalidDataException("Image path missing"));
                var bytes=File.ReadAllBytes(path);
                if(!verified.Contains(path))
                {
                    var hash=Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(bytes));
                    if(hash!=operation.Sha256)throw new InvalidDataException("Scene image checksum mismatch");
                    verified.Add(path);
                }
                using var stream=new MemoryStream(bytes,false);
                using var image=System.Drawing.Image.FromStream(stream);
                if(operation.Kind=="metafile"&&image is not Metafile)throw new InvalidDataException("Vector asset is not a metafile");
                var r=operation.Rect;
                var destination=new RectangleF((float)((r[0]-scene.Viewport[0])*scale),(float)((r[1]-scene.Viewport[1])*scale),
                    (float)((r[2]-r[0])*scale),(float)((r[3]-r[1])*scale));
                if(operation.Kind=="metafile")
                {
                    graphics.PixelOffsetMode=PixelOffsetMode.Default;
                    graphics.DrawImage(image,destination);
                }
                else if(scale==1&&image.Width==r[2]-r[0]&&image.Height==r[3]-r[1])
                    graphics.DrawImageUnscaled(image,(int)destination.X,(int)destination.Y);
                else
                {
                    graphics.InterpolationMode=InterpolationMode.NearestNeighbor;
                    graphics.PixelOffsetMode=PixelOffsetMode.Half;
                    graphics.DrawImage(image,destination,new RectangleF(0,0,image.Width,image.Height),GraphicsUnit.Pixel);
                }
            }
            else if(operation.Kind=="text")
            {
                if(operation.FillBackground&&operation.BackgroundColor is not null)PaintGeometry(graphics,new SceneOperation {Kind="fill_rectangle",Rect=operation.Rect,Color=operation.BackgroundColor},scene.Viewport,scale);
                NativeText.Draw(graphics,operation.Lines,scene.Viewport[0],scene.Viewport[1],scale);
            }
            else PaintGeometry(graphics,operation,scene.Viewport,scale);
        }
        cancellation.ThrowIfCancellationRequested();
        using var output=new MemoryStream();bitmap.Save(output,ImageFormat.Png);
        RenderCount++;
        return new SceneRenderResult(output.ToArray(),pixelWidth,pixelHeight,scale,scene.VectorAssetCount,scene.GeometryCount,scene.RasterAssetCount);
    }
    string Resolve(string relative)
    {
        var path=System.IO.Path.GetFullPath(System.IO.Path.Combine(contentRoot,relative));
        if(!path.StartsWith(contentRoot+System.IO.Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Scene image outside content directory");
        return path;
    }
    [StructLayout(LayoutKind.Sequential)] struct Point {public int X,Y;public Point(int x,int y){X=x;Y=y;}}
    [StructLayout(LayoutKind.Sequential)] struct Rect {public int L,T,R,B;public Rect(int l,int t,int r,int b){L=l;T=t;R=r;B=b;}}
    [DllImport("user32.dll")]static extern int FillRect(IntPtr dc,ref Rect rect,IntPtr brush);
    [DllImport("gdi32.dll")]static extern int SaveDC(IntPtr dc);
    [DllImport("gdi32.dll")]static extern bool RestoreDC(IntPtr dc,int saved);
    [DllImport("gdi32.dll")]static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
    [DllImport("gdi32.dll")]static extern IntPtr GetStockObject(int index);
    [DllImport("gdi32.dll")]static extern IntPtr CreateSolidBrush(uint color);
    [DllImport("gdi32.dll")]static extern IntPtr CreatePen(int style,int width,uint color);
    [DllImport("gdi32.dll")]static extern bool DeleteObject(IntPtr obj);
    [DllImport("gdi32.dll")]static extern bool Rectangle(IntPtr dc,int l,int t,int r,int b);
    [DllImport("gdi32.dll")]static extern bool Ellipse(IntPtr dc,int l,int t,int r,int b);
    [DllImport("gdi32.dll")]static extern bool Polygon(IntPtr dc,Point[] points,int count);
    [DllImport("gdi32.dll")]static extern bool MoveToEx(IntPtr dc,int x,int y,IntPtr previous);
    [DllImport("gdi32.dll")]static extern bool LineTo(IntPtr dc,int x,int y);
    [DllImport("gdi32.dll")]static extern bool GdiFlush();
    static void PaintGeometry(Graphics graphics,SceneOperation op,int[] viewport,double scale)
    {
        int X(int x)=>(int)Math.Round((x-viewport[0])*scale,MidpointRounding.AwayFromZero);
        int Y(int y)=>(int)Math.Round((y-viewport[1])*scale,MidpointRounding.AwayFromZero);
        var dc=graphics.GetHdc();var saved=SaveDC(dc);IntPtr pen=IntPtr.Zero,brush=IntPtr.Zero;
        try
        {
            var color=(uint)(op.Color[0]|op.Color[1]<<8|op.Color[2]<<16);
            var outline=op.Kind.StartsWith("stroke_",StringComparison.Ordinal)||op.Kind=="line";
            if(outline){pen=CreatePen(0,Math.Max(1,(int)Math.Round(op.PenWidth*scale)),color);SelectObject(dc,pen);SelectObject(dc,GetStockObject(5));}
            else{brush=CreateSolidBrush(color);SelectObject(dc,brush);SelectObject(dc,GetStockObject(8));}
            bool success;
            if(op.Kind=="fill_polygon")
            {
                var points=op.Points.Select(p=>new Point(X(p[0]),Y(p[1]))).ToArray();
                success=Polygon(dc,points,points.Length);
            }
            else if(op.Kind=="line")
                success=MoveToEx(dc,X(op.Points[0][0]),Y(op.Points[0][1]),IntPtr.Zero)&&LineTo(dc,X(op.Points[1][0]),Y(op.Points[1][1]));
            else if(op.Kind=="fill_rectangle")
            {
                var rect=new Rect(X(op.Rect[0]),Y(op.Rect[1]),X(op.Rect[2]),Y(op.Rect[3]));
                success=FillRect(dc,ref rect,brush)!=0;
            }
            else if(op.Kind.EndsWith("rectangle",StringComparison.Ordinal))
                success=Rectangle(dc,X(op.Rect[0]),Y(op.Rect[1]),X(op.Rect[2]),Y(op.Rect[3]));
            else if(op.Kind.EndsWith("ellipse",StringComparison.Ordinal))
                success=Ellipse(dc,X(op.Rect[0]),Y(op.Rect[1]),X(op.Rect[2]),Y(op.Rect[3]));
            else throw new InvalidDataException("Unsupported vector operation "+op.Kind);
            if(!success||!GdiFlush())throw new InvalidOperationException("Vector drawing failed");
        }
        finally{RestoreDC(dc,saved);if(pen!=IntPtr.Zero)DeleteObject(pen);if(brush!=IntPtr.Zero)DeleteObject(brush);graphics.ReleaseHdc(dc);}
    }
}
