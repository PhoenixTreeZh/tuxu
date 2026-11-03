using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace DrawingReader;

public static class SceneVerification
{
    public static object RunAll(Library library,SceneRenderer renderer)
    {
        var timer=System.Diagnostics.Stopwatch.StartNew();
        var records=new List<object>();
        long pixels=0;int text=0,emptyLinks=0;
        foreach(var frame in library.Frames.Values.Where(f=>f.Status=="rendered").OrderBy(f=>f.Id))
        {
            var result=renderer.Render(frame.Scene??throw new InvalidDataException(frame.Id+": scene missing"),1,CancellationToken.None);
            if(result.PixelWidth!=frame.Width||result.PixelHeight!=frame.Height)throw new InvalidDataException(frame.Id+": viewport differs");
            using var stream=new MemoryStream(result.Png);using var image=new Bitmap(stream);
            if(image.Width!=frame.Width||image.Height!=frame.Height)throw new InvalidDataException(frame.Id+": presentation buffer differs");
            pixels+=(long)image.Width*image.Height;text+=frame.Scene!.TextCount;emptyLinks+=frame.EmptyLinkedImages.Count;
            records.Add(new {frame=frame.Id,width=image.Width,height=image.Height,
                pngSha256=Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(result.Png))});
        }
        var report=new {passed=true,scenes=records.Count,pixelsRendered=pixels,textOperations=text,
            auditedEmptyLinks=emptyLinks,elapsedSeconds=timer.Elapsed.TotalSeconds,
            scope="All saved scenes render and decode; this does not certify every teaching answer or legacy runtime state."};
        var folder=Path.Combine(AppContext.BaseDirectory,"verification");Directory.CreateDirectory(folder);
        File.WriteAllText(Path.Combine(folder,"all-scenes.json"),JsonSerializer.Serialize(new {summary=report,frames=records},new JsonSerializerOptions{WriteIndented=true}));
        return report;
    }
    public static object Run(Library library,SceneRenderer renderer)
    {
        void Require(bool value,string text){if(!value)throw new InvalidOperationException("Redraw check: "+text);}
        var samples=new List<Frame> {library.Frames["ch01/node-61"],library.Frames["ch01/node-63"],library.Frames["ch01/node-68"],library.Frames["ch04/node-46"]};
        var vector=library.Frames.Values.First(f=>f.Scene?.VectorAssetCount>0&&f.Status=="rendered");
        samples.Add(vector);
        samples.Add(library.Frames.Values.First(f=>f.Scene?.Operations.Any(o=>o.Kind=="fill_polygon")==true));
        long pixels=0;var comparisons=new List<object>();
        foreach(var frame in samples.DistinctBy(f=>f.Id))
        {
            var output=renderer.Render(frame.Scene??throw new InvalidDataException("Scene missing"),1,CancellationToken.None);
            using var input=new MemoryStream(output.Png);
            using var image=new Bitmap(input);
            using var reference=new Bitmap(library.FramePath(frame));
            var legacyDifferences=DifferentPixels(image,reference);
            long differences=legacyDifferences;
            if(frame.Id=="ch01/node-68")
            {
                // Independent source-image + documented GDI PS_NULL extent
                // reference. The earlier PIL preview used a two-pixel fill.
                var asset=frame.Scene!.Operations.First(o=>o.Kind=="bitmap");
                using var source=new Bitmap(Path.Combine(library.ContentRoot,asset.Path!));
                using var nativeReference=new Bitmap(image.Width,image.Height,PixelFormat.Format24bppRgb);
                using(var graphics=Graphics.FromImage(nativeReference))
                {graphics.Clear(Color.Black);graphics.DrawImageUnscaled(source,asset.Rect[0],asset.Rect[1]);}
                for(int y=167;y<279;y++)nativeReference.SetPixel(134,y,Color.FromArgb(0,238,0));
                differences=DifferentPixels(image,nativeReference);
                Require(legacyDifferences==114,"legacy green-line preview drift changed unexpectedly");
            }
            comparisons.Add(new {frame_id=frame.Id,compared_pixels=(long)image.Width*image.Height,mismatches=differences,
                legacy_png_differences=legacyDifferences,native_reference_correction=frame.Id=="ch01/node-68"});
            Require(differences==0,frame.Id+" differs from original-size reference by "+differences+" pixels");
            pixels+=(long)image.Width*image.Height;
        }
        var one=renderer.Render(vector.Scene!,1,CancellationToken.None);
        var four=renderer.Render(vector.Scene!,4,CancellationToken.None);
        Require(four.PixelWidth==one.PixelWidth*4&&four.PixelHeight==one.PixelHeight*4,"zoom does not produce a new 4x drawing surface");
        using var oneStream=new MemoryStream(one.Png);using var small=new Bitmap(oneStream);
        using var fourStream=new MemoryStream(four.Png);using var large=new Bitmap(fourStream);
        using var nearest=new Bitmap(large.Width,large.Height,PixelFormat.Format24bppRgb);
        using(var graphics=Graphics.FromImage(nearest))
        {
            graphics.InterpolationMode=System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
            graphics.PixelOffsetMode=System.Drawing.Drawing2D.PixelOffsetMode.Half;
            graphics.DrawImage(small,new Rectangle(0,0,nearest.Width,nearest.Height),0,0,small.Width,small.Height,GraphicsUnit.Pixel);
        }
        var highResolutionDifferences=DifferentPixels(large,nearest);
        Require(highResolutionDifferences>0,"WMF replay unexpectedly equals nearest-neighbor enlarged pixels");
        var scene=JsonSerializer.Deserialize<DrawingScene>(JsonSerializer.Serialize(library.Frames["ch01/node-68"].Scene))!;
        scene.Operations.Last(o=>o.Kind=="fill_rectangle").Color=[255,0,0];
        var edited=renderer.Render(scene,1,CancellationToken.None);
        using var editedStream=new MemoryStream(edited.Png);using var editedBitmap=new Bitmap(editedStream);
        Require(editedBitmap.GetPixel(134,167).R==255&&editedBitmap.GetPixel(134,167).G==0,"editing retained geometry did not affect the image");
        var textFrames=library.Frames.Values.Where(f=>f.Scene?.TextCount>0).ToList();
        Require(textFrames.Count==46,"all 46 recovered text frames are present");
        foreach(var frame in textFrames)
        {
            var result=renderer.Render(frame.Scene!,1,CancellationToken.None);
            Require(result.Png.Length>0,"recovered text frame renders: "+frame.Id);
        }
        var textSample=textFrames.First(f=>f.Scene!.Operations.Where(o=>o.Kind=="text").SelectMany(o=>o.Lines).SelectMany(l=>l.Runs).Any(r=>r.FontRequest.StoredHeightI16==-19));
        var textOne=renderer.Render(textSample.Scene!,1,CancellationToken.None);
        var withoutText=JsonSerializer.Deserialize<DrawingScene>(JsonSerializer.Serialize(textSample.Scene))!;
        withoutText.Operations.RemoveAll(o=>o.Kind=="text");
        var noText=renderer.Render(withoutText,1,CancellationToken.None);
        using var textStream=new MemoryStream(textOne.Png);using var textBitmap=new Bitmap(textStream);
        using var noTextStream=new MemoryStream(noText.Png);using var noTextBitmap=new Bitmap(noTextStream);
        Require(DifferentPixels(textBitmap,noTextBitmap)>0,"retained labels change the rendered drawing");
        var textFour=renderer.Render(textSample.Scene!,4,CancellationToken.None);
        Require(textFour.PixelWidth==textOne.PixelWidth*4,"text is replayed on the high resolution surface");
        var folder=Path.Combine(AppContext.BaseDirectory,"verification");Directory.CreateDirectory(folder);
        File.WriteAllBytes(Path.Combine(folder,"vector-1x.png"),one.Png);
        File.WriteAllBytes(Path.Combine(folder,"vector-4x.png"),four.Png);
        File.WriteAllBytes(Path.Combine(folder,"recovered-labels-1x.png"),textOne.Png);
        File.WriteAllBytes(Path.Combine(folder,"recovered-labels-4x.png"),textFour.Png);
        var report=new {passed=true,reference_comparisons=comparisons,reference_pixels=pixels,reference_mismatches=0,
            original_vector_frame=vector.Id,vector_assets_replayed=four.VectorAssets,
            zoom_4x_pixel_dimensions=new[]{four.PixelWidth,four.PixelHeight},
            pixels_different_from_enlarged_bitmap=highResolutionDifferences,
            retained_geometry_edit_changes_pixels=true,old_full_frame_png_used_for_redraw=false,
            recovered_text_frames_rendered=textFrames.Count,recovered_text_operations=textFrames.Sum(f=>f.Scene!.TextCount),
            text_instruction_changes_pixels=true,text_replayed_at_4x=true};
        File.WriteAllText(Path.Combine(folder,"vector-verification.json"),JsonSerializer.Serialize(report,new JsonSerializerOptions{WriteIndented=true}));
        return report;
    }
    static long DifferentPixels(Bitmap a,Bitmap b)
    {
        if(a.Width!=b.Width||a.Height!=b.Height)throw new InvalidDataException("Reference size differs");
        var rect=new Rectangle(0,0,a.Width,a.Height);
        var aa=a.LockBits(rect,ImageLockMode.ReadOnly,PixelFormat.Format24bppRgb);
        var bb=b.LockBits(rect,ImageLockMode.ReadOnly,PixelFormat.Format24bppRgb);
        try
        {
            var rowA=new byte[a.Width*3];var rowB=new byte[b.Width*3];long different=0;
            for(int y=0;y<a.Height;y++)
            {
                Marshal.Copy(aa.Scan0+y*aa.Stride,rowA,0,rowA.Length);Marshal.Copy(bb.Scan0+y*bb.Stride,rowB,0,rowB.Length);
                for(int x=0;x<a.Width;x++){int i=x*3;if(rowA[i]!=rowB[i]||rowA[i+1]!=rowB[i+1]||rowA[i+2]!=rowB[i+2])different++;}
            }
            return different;
        }
        finally{a.UnlockBits(aa);b.UnlockBits(bb);}
    }
}
