using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace DrawingReader;

public sealed class Library
{
    public int Version { get; set; }
    public string ContentRoot { get; private set; } = "";
    public List<Chapter> Chapters { get; set; } = [];
    public List<Question> Questions { get; set; } = [];
    public Dictionary<string, Frame> Frames { get; set; } = [];
    public Dictionary<string, EmbeddedAnimation> Animations { get; set; } = [];

    public static async Task<Library> ReadAsync(string directory)
    {
        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };
        var json = await File.ReadAllTextAsync(Path.Combine(directory, "library.json"));
        var library = JsonSerializer.Deserialize<Library>(json, options) ?? throw new InvalidDataException("Empty library");
        library.ContentRoot = Path.GetFullPath(directory);
        if(library.Version<2||library.Frames.Values.Any(f=>f.Status=="rendered"&&f.Scene is null))
            throw new InvalidDataException("The matching vector scene library is missing. Regenerate or copy the complete content package.");
        if (library.Questions.Select(q => q.Id).Distinct().Count() != library.Questions.Count)
            throw new InvalidDataException("Duplicate question IDs");
        foreach(var frame in library.Frames.Values)
            foreach(var hotspot in frame.Hotspots)
            {
                if(hotspot.Rect.Length!=4||hotspot.Rect[2]<=hotspot.Rect[0]||hotspot.Rect[3]<=hotspot.Rect[1])
                    throw new InvalidDataException("Invalid clickable drawing region");
                if(hotspot.Kind=="animation"?!library.Animations.ContainsKey(hotspot.TargetAnimationId??""):
                    !library.Frames.ContainsKey(hotspot.TargetFrameId??""))
                    throw new InvalidDataException("Clickable drawing target missing");
            }
        return library;
    }

    public string FramePath(Frame frame)
    {
        if (frame.Image is null) throw new InvalidDataException("Frame unavailable");
        var path = Path.GetFullPath(Path.Combine(ContentRoot, frame.Image));
        if (!path.StartsWith(ContentRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Frame path outside content folder");
        return path;
    }

    public IEnumerable<Question> Search(string chapter, int? page, string query)
    {
        query = Regex.Replace(query.Normalize(NormalizationForm.FormKC).ToUpperInvariant().Trim(), @"\s+", "")
            .Replace('－', '-').Replace('—', '-').Replace('–', '-');
        var pageQuery = Regex.Match(query, @"^(?:第)?(\d+)(?:页)?$");
        var keyQuery = Regex.Match(query, @"^P?(\d+(?:-\d+)+)$");
        var key = keyQuery.Success ? "P" + string.Join('-', keyQuery.Groups[1].Value.Split('-').Select(part=>part.TrimStart('0') is var number&&number.Length>0?number:"0")) : null;
        var queryPage=0;
        if(pageQuery.Success&&!int.TryParse(pageQuery.Groups[1].Value,out queryPage))return Enumerable.Empty<Question>();
        return Questions.Where(q => !q.HiddenAsClickDetail && (chapter == "all" || q.ChapterId == chapter) &&
            (!page.HasValue || q.Page == page) &&
            (query.Length == 0 || (pageQuery.Success ? q.Page == queryPage :
                key is not null ? MatchesKey(q,key,!query.StartsWith("P",StringComparison.Ordinal)) :
                (q.Key + q.Title).Contains(query, StringComparison.OrdinalIgnoreCase))))
            .OrderBy(q => q.ChapterId).ThenBy(q => q.Page ?? 999)
            .ThenBy(q => Regex.Replace(q.Key, @"\d+", m => m.Value.PadLeft(6, '0')), StringComparer.Ordinal);
    }
    static bool MatchesKey(Question question,string key,bool allowVideoNumbers)
    {
        if(question.Key==key||question.Key.StartsWith(key+"-",StringComparison.Ordinal)||
            question.QueryAliases.Any(alias=>alias==key||alias.StartsWith(key+"-",StringComparison.Ordinal)))return true;
        if(question.VideoPath is null||!allowVideoNumbers)return false;
        var number=key[1..];var title=question.Key.Normalize(NormalizationForm.FormKC);
        return title.StartsWith(number,StringComparison.OrdinalIgnoreCase)&&
            (title.Length==number.Length||!char.IsDigit(title[number.Length]));
    }
}

#if !DESKTOP_STUDIO
[Microsoft.UI.Xaml.Data.Bindable]
#endif
public sealed class Chapter
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public List<int> Pages { get; set; } = [];
    public override string ToString() => Title;
}
#if !DESKTOP_STUDIO
[Microsoft.UI.Xaml.Data.Bindable]
#endif
public sealed class Question
{
    public string Id { get; set; } = "";
    public string ChapterId { get; set; } = "";
    public string Key { get; set; } = "";
    public string Title { get; set; } = "";
    public int? Page { get; set; }
    public string ContentStatus { get; set; } = "";
    public List<Branch> Branches { get; set; } = [];
    public List<string> QuestionFrameIds { get; set; } = [];
    public List<string> SupplementFrameIds { get; set; } = [];
    public int AvailableAnswerBranches { get; set; }
    public string? VideoPath { get; set; }
    public string? AnswerCaption { get; set; }
    public bool HiddenAsClickDetail { get; set; }
    public List<string> QueryAliases { get; set; } = [];
    public List<string>? RootQuestionFrameIds { get; set; }
    public List<string>? RootSupplementFrameIds { get; set; }
    public List<string> DetailFrameIds { get; set; } = [];
    public IEnumerable<Branch> VisibleBranches => Branches.Where(b=>!b.HiddenAsClickDetail&&!b.HiddenAsClearFrame);
    public List<string> ReaderQuestionFrameIds => RootQuestionFrameIds??QuestionFrameIds;
    public List<string> ReaderSupplementFrameIds => RootSupplementFrameIds??SupplementFrameIds;
    public string Caption => VideoPath is not null?"视频 · 点击播放":(Page.HasValue ? $"第 {Page} 页" : "视频") + " · " +
        (VisibleBranches.FirstOrDefault(b=>b.Kind=="steps"&&b.CompleteFramesAvailable) is Branch steps ? $"{steps.FrameIds.Count} 步" : AvailableAnswerBranches > 0 ? DetailFrameIds.Count>0?"总图 · 可点详图":"答案图" : "整理中");
    public override string ToString() => Title;
}
#if !DESKTOP_STUDIO
[Microsoft.UI.Xaml.Data.Bindable]
#endif
public sealed class Branch
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public string Kind { get; set; } = "";
    public List<string> FrameIds { get; set; } = [];
    public bool CompleteFramesAvailable { get; set; }
    public bool HiddenAsClickDetail { get; set; }
    public bool HiddenAsClearFrame { get; set; }
    public override string ToString() => $"{Label} · {FrameIds.Count} {(Kind == "steps" ? "步" : "张")}" + (CompleteFramesAvailable ? "" : "（整理中）");
}
public sealed class Frame
{
    public string Id { get; set; } = "";
    public string QuestionId { get; set; } = "";
    public string Role { get; set; } = "";
    public string Status { get; set; } = "";
    public string? Image { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public List<string> Captions { get; set; } = [];
    public DrawingScene? Scene { get; set; }
    public List<JsonElement> EmptyLinkedImages { get; set; } = [];
    public List<DrawingHotspot> Hotspots { get; set; } = [];
    public string? BackTargetFrameId { get; set; }
    public EmbeddedAnimation? Animation { get; set; }
}

public sealed class DrawingHotspot
{
    public string Id { get; set; } = "";
    public int[] Rect { get; set; } = [];
    public string Kind { get; set; } = "detail";
    public string Label { get; set; } = "局部详图";
    public string? TargetFrameId { get; set; }
    public string? TargetAnimationId { get; set; }
}
public sealed class EmbeddedAnimation
{
    public string Id { get; set; } = "";
    public string Path { get; set; } = "";
    public string Sha256 { get; set; } = "";
    public int Width { get; set; }
    public int Height { get; set; }
    public int FrameCount { get; set; }
}
