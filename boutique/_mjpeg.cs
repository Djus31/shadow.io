using System;
using System.IO;
using System.Linq;
using System.Text;

class MjpegAvi {
  static void Dword(BinaryWriter w, uint v) { w.Write(v); }
  static void Word(BinaryWriter w, ushort v) { w.Write(v); }
  static void Four(BinaryWriter w, string s) { w.Write(Encoding.ASCII.GetBytes(s)); }

  static void Main(string[] args) {
    string dir = args[0];
    string outPath = args[1];
    int fps = args.Length > 2 ? int.Parse(args[2]) : 6;
    var files = Directory.GetFiles(dir, "*.jpg").Concat(Directory.GetFiles(dir, "*.jpeg")).OrderBy(x => x).ToArray();
    if (files.Length == 0) throw new Exception("no jpg in " + dir);
    var frames = files.Select(File.ReadAllBytes).ToList();
    int w = 1280, h = 720;
    using (var ms = new MemoryStream(frames[0]))
    using (var img = System.Drawing.Image.FromStream(ms)) {
      w = img.Width; h = img.Height;
    }
    int n = frames.Count;
    int maxJpeg = 0;
    foreach (var f in frames) maxJpeg = Math.Max(maxJpeg, f.Length);
    int pad = (maxJpeg + 3) & ~3;
    uint moviSize = (uint)(n * (8 + pad));
    uint avih = 56, strh = 56, strf = 40;
    uint hdrl = 4 + 8 + avih + 12 + 8 + strh + 8 + strf;
    uint riff = 4 + 8 + hdrl + 8 + 4 + moviSize;
    using (var fs = File.Create(outPath))
    using (var bw = new BinaryWriter(fs)) {
      Four(bw, "RIFF"); Dword(bw, riff); Four(bw, "AVI ");
      Four(bw, "LIST"); Dword(bw, hdrl); Four(bw, "hdrl");
      Four(bw, "avih"); Dword(bw, avih);
      Dword(bw, (uint)(1000000 / fps));
      Dword(bw, (uint)(pad * fps));
      Dword(bw, 0); Dword(bw, 0x10); Dword(bw, (uint)n);
      Dword(bw, 0); Dword(bw, 1); Dword(bw, (uint)pad);
      Dword(bw, (uint)w); Dword(bw, (uint)h);
      Dword(bw, 0); Dword(bw, 0); Dword(bw, 0); Dword(bw, 0);
      Four(bw, "LIST"); Dword(bw, 4 + 8 + strh + 8 + strf); Four(bw, "strl");
      Four(bw, "strh"); Dword(bw, strh);
      Four(bw, "vids"); Four(bw, "MJPG");
      Dword(bw, 0); Word(bw, 0); Word(bw, 0); Dword(bw, 0);
      Dword(bw, 1); Dword(bw, (uint)fps); Dword(bw, 0); Dword(bw, (uint)n);
      Dword(bw, (uint)pad); Dword(bw, unchecked((uint)-1)); Dword(bw, 0);
      Word(bw, 0); Word(bw, 0); Word(bw, (ushort)w); Word(bw, (ushort)h);
      Four(bw, "strf"); Dword(bw, strf);
      Dword(bw, 40); Dword(bw, (uint)w); Dword(bw, (uint)h);
      Word(bw, 1); Word(bw, 24); Four(bw, "MJPG");
      Dword(bw, (uint)(w * h * 3)); Dword(bw, 0); Dword(bw, 0); Dword(bw, 0); Dword(bw, 0);
      Four(bw, "LIST"); Dword(bw, 4 + moviSize); Four(bw, "movi");
      foreach (var f in frames) {
        Four(bw, "00dc");
        Dword(bw, (uint)pad);
        bw.Write(f);
        int extra = pad - f.Length;
        if (extra > 0) bw.Write(new byte[extra]);
      }
    }
    Console.WriteLine("OK " + n + " " + w + "x" + h);
  }
}
