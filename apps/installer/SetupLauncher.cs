using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;
using Microsoft.Win32;
using System.Security.Principal;

// .NET Framework 4.x is included in Windows 11. This executable starts without
// extracting a runtime, so it can repair the child's TEMP before Inno starts.
internal static class SetupLauncher
{
    private static readonly List<string> Notes = new List<string>();

    [STAThread]
    private static int Main(string[] args)
    {
        string work = null;
        string log = null;
        bool quiet = Array.Exists(args, x => x.Equals("/VERYSILENT", StringComparison.OrdinalIgnoreCase)
            || x.Equals("/SUPPRESSMSGBOXES", StringComparison.OrdinalIgnoreCase));
        try
        {
            string location = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string id = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N");
            Notes.Add("DrawingStudio installer icon-7 " + DateTime.UtcNow.ToString("o"));
            using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
                Notes.Add("Administrator token=" + new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator));
            Notes.Add("Original TEMP=" + Environment.GetEnvironmentVariable("TEMP"));
            Notes.Add("Original TMP=" + Environment.GetEnvironmentVariable("TMP"));
            // Prefer a location alongside this download. Do not depend on the
            // system TEMP being usable for either file creation or execution.
            string[] candidates = {
                Path.Combine(location, "DrawingStudio-Setup-Temp"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DrawingStudio", "SetupTemp"),
                Environment.GetEnvironmentVariable("TMP"),
                Environment.GetEnvironmentVariable("TEMP")
            };
            foreach (string candidate in candidates)
            {
                if (String.IsNullOrWhiteSpace(candidate)) continue;
                string attempt = null;
                try
                {
                    attempt = Path.Combine(Path.GetFullPath(candidate), "tuxu-" + id);
                    Directory.CreateDirectory(attempt);
                    string probe = Path.Combine(attempt, "write-probe");
                    using (var stream = new FileStream(probe, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None))
                    {
                        stream.WriteByte(42);
                        stream.Flush(true);
                        stream.Position = 0;
                        if (stream.ReadByte() != 42) throw new IOException("Write probe failed");
                    }
                    File.Delete(probe);
                    work = attempt;
                    break;
                }
                catch (Exception ex)
                {
                    Notes.Add("Rejected " + candidate + ": " + ex.Message);
                    if (attempt != null) TryRemoveOwnedDirectory(attempt);
                }
            }
            if (work == null) throw new IOException("没有找到可写的安装临时目录。请将安装包放到自己可写的文件夹后再打开。");
            string tempRoot = Path.GetDirectoryName(work);
            Notes.Add("Selected TEMP=" + tempRoot);
            Notes.Add("Owned payload directory=" + work);
            log = Path.Combine(tempRoot, "DrawingStudio-install-" + id + ".log");
            FlushLog(log);

            string explicitDirectory = Array.Find(args, x => x.StartsWith("/DIR=", StringComparison.OrdinalIgnoreCase));
            string installDirectory = explicitDirectory == null
                ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DrawingStudio")
                : explicitDirectory.Substring(5);
            if (explicitDirectory != null && !CanWriteDirectory(installDirectory))
                throw new IOException("无法写入指定的安装目录：" + installDirectory + "。请使用 /DIR 指定自己的可写文件夹。");
            bool registryAllowed = CanRegisterUninstall();
            bool menuAllowed = CanWriteDirectory(Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Programs), "图序"));
            bool desktopAllowed = CanWriteDirectory(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
            Notes.Add("Default install directory=" + installDirectory);
            Notes.Add("Uninstall registry allowed=" + registryAllowed);
            Notes.Add("Start menu allowed=" + menuAllowed);
            Notes.Add("Desktop shortcut allowed=" + desktopAllowed);

            string setup = Path.Combine(work, "DrawingStudio-Setup.exe");
            using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream("DrawingStudio.SetupPayload"))
            using (var output = new FileStream(setup, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            using (SHA256 hash = SHA256.Create())
            {
                if (input == null) throw new InvalidDataException("安装载荷缺失，请重新获取完整安装包。");
                byte[] buffer = new byte[1024 * 1024];
                int count;
                while ((count = input.Read(buffer, 0, buffer.Length)) > 0)
                {
                    output.Write(buffer, 0, count);
                    hash.TransformBlock(buffer, 0, count, buffer, 0);
                }
                hash.TransformFinalBlock(new byte[0], 0, 0);
                output.Flush(true);
                string actual = BitConverter.ToString(hash.Hash).Replace("-", "").ToLowerInvariant();
                if (actual != SetupPayload.Sha256) throw new InvalidDataException("安装载荷校验失败，请重新获取完整安装包。");
            }
            Notes.Add("Payload SHA256 verified=" + SetupPayload.Sha256);
            if (Array.Exists(args, x => x.Equals("/BOOTSTRAPCHECK", StringComparison.OrdinalIgnoreCase)))
            {
                Notes.Add("Preparation check passed; installer not launched.");
                return 0;
            }
            var forwarded = new List<string>(args);
            // Leave the default to Inno's DefaultDirName. Never replace the
            // user's requested AppData default with an automatically chosen path.
            if (!forwarded.Exists(x => x.StartsWith("/LOG=", StringComparison.OrdinalIgnoreCase)))
                forwarded.Add("/LOG=" + Path.ChangeExtension(log, ".inno.log"));
            var start = new ProcessStartInfo(setup);
            start.UseShellExecute = false;
            start.WorkingDirectory = work;
            // Keep the parent available: an application opened from Inno's
            // final page inherits TEMP and may outlive the installer itself.
            start.EnvironmentVariables["TEMP"] = tempRoot;
            start.EnvironmentVariables["TMP"] = tempRoot;
            start.EnvironmentVariables["DRAWINGSTUDIO_UNINSTALL_REGISTRY"] = registryAllowed ? "1" : "0";
            start.EnvironmentVariables["DRAWINGSTUDIO_START_MENU"] = menuAllowed ? "1" : "0";
            start.EnvironmentVariables["DRAWINGSTUDIO_DESKTOP"] = desktopAllowed ? "1" : "0";
            start.Arguments = String.Join(" ", forwarded.ConvertAll(QuoteArgument).ToArray());
            using (Process child = Process.Start(start))
            {
                child.WaitForExit();
                Notes.Add("Installer exit code=" + child.ExitCode);
                return child.ExitCode;
            }
        }
        catch (Exception ex)
        {
            Notes.Add("FAILED: " + ex);
            if (!quiet) MessageBox.Show("安装未能启动：\r\n" + ex.Message +
                (log == null ? "" : "\r\n\r\n诊断日志：" + log), "图序安装", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        finally
        {
            if (work != null)
            {
                try { RemoveOwnedDirectory(work); Notes.Add("Temporary payload cleaned."); }
                catch (Exception ex) { Notes.Add("Temporary payload retained: " + ex.Message); }
            }
            FlushLog(log);
        }
    }

    private const string UninstallParent = @"Software\Microsoft\Windows\CurrentVersion\Uninstall";

    private static bool CanWriteDirectory(string directory)
    {
        string probe = null;
        bool existed = Directory.Exists(directory);
        try
        {
            Directory.CreateDirectory(directory);
            probe = Path.Combine(directory, ".tuxu-write-probe-" + Guid.NewGuid().ToString("N"));
            using (var stream = new FileStream(probe, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None))
            {
                stream.WriteByte(42);
                stream.Flush(true);
                stream.Position = 0;
                if (stream.ReadByte() != 42) throw new IOException("Write probe failed");
            }
            File.Delete(probe);
            probe = null;
            return true;
        }
        catch (Exception ex) { Notes.Add("Directory unavailable " + directory + ": " + ex.Message); return false; }
        finally
        {
            try { if (probe != null && File.Exists(probe)) File.Delete(probe); } catch { }
            // Never recursively remove a candidate or touch existing contents.
            try { if (!existed && Directory.Exists(directory)) Directory.Delete(directory, false); } catch { }
        }
    }

    private static bool CanRegisterUninstall()
    {
        string probe = UninstallParent + @"\DrawingStudio-WriteProbe-" + Guid.NewGuid().ToString("N");
        bool created = false;
        try
        {
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(probe))
            {
                created = key != null;
                if (!created) return false;
                key.SetValue("probe", "1", RegistryValueKind.String);
            }
            return true;
        }
        catch (Exception ex) { Notes.Add("Uninstall registration unavailable: " + ex.Message); return false; }
        finally
        {
            if (created) try { Registry.CurrentUser.DeleteSubKeyTree(probe); }
                catch (Exception ex) { Notes.Add("Registry probe cleanup: " + ex.Message); }
        }
    }

    // Preserve quoting of /DIR and /LOG values, including Unicode, embedded
    // spaces and trailing backslashes. No shell or string-built command is used.
    private static string QuoteArgument(string value)
    {
        var result = new StringBuilder("\"");
        int slashes = 0;
        foreach (char c in value)
        {
            if (c == '\\') { slashes++; continue; }
            if (c == '"') result.Append('\\', slashes * 2 + 1);
            else result.Append('\\', slashes);
            result.Append(c);
            slashes = 0;
        }
        result.Append('\\', slashes * 2);
        return result.Append('"').ToString();
    }

    private static void FlushLog(string path)
    {
        if (path == null) return;
        try { File.WriteAllLines(path, Notes, new UTF8Encoding(false)); }
        catch { /* Logging failure must not prevent installation. */ }
    }

    private static void TryRemoveOwnedDirectory(string path)
    {
        try { RemoveOwnedDirectory(path); } catch { }
    }

    private static void RemoveOwnedDirectory(string path)
    {
        string full = Path.GetFullPath(path);
        string name = Path.GetFileName(full);
        if (!name.StartsWith("tuxu-", StringComparison.Ordinal) || name.Length != 53)
            throw new IOException("Refusing to remove an unowned directory");
        if (Directory.Exists(full)) RemoveTreeWithoutLinks(full);
    }

    private static void RemoveTreeWithoutLinks(string path)
    {
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
            throw new IOException("Refusing to follow a directory link");
        foreach (string entry in Directory.GetFileSystemEntries(path))
        {
            FileAttributes attributes = File.GetAttributes(entry);
            if ((attributes & FileAttributes.ReparsePoint) != 0)
                throw new IOException("Refusing to follow a file link");
            if ((attributes & FileAttributes.Directory) != 0) RemoveTreeWithoutLinks(entry);
            else File.Delete(entry);
        }
        Directory.Delete(path);
    }
}
