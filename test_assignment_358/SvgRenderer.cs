using System;
using System.IO;
using System.Text;

namespace GeometrySolver;

public static class SvgRenderer
{
    public static void Generate(string path, GeometryInput input, GeometrySolution solution)
    {
        double margin = 2.0;
        double minX = Math.Min(input.P1.X, input.P3.X) - margin;
        double maxX = Math.Max(input.P2.X, input.P4.X) + margin;
        double minY = input.P1.Y - margin;
        double maxY = input.P5.Y + margin;

        double svgWidth = 800;
        double svgHeight = 620;

        double rangeX = maxX - minX;
        double rangeY = maxY - minY;
        double scaleX = (svgWidth * 0.80) / rangeX;
        double scaleY = (svgHeight * 0.75) / rangeY;
        double scale = Math.Min(scaleX, scaleY);

        double paddingLeft = (svgWidth - rangeX * scale) / 2;
        double paddingTop = (svgHeight * 0.82 - rangeY * scale) / 2 + 40;

        (double sx, double sy) ToSvg(double wx, double wy) =>
            ((wx - minX) * scale + paddingLeft, paddingTop + (maxY - wy) * scale);

        string PS(double wx, double wy)
        {
            var (sx, sy) = ToSvg(wx, wy);
            return $"{sx:F1},{sy:F1}";
        }

        string BeamPolygon(double ax1, double ay1, double ax2, double ay2, double width)
        {
            double dx = ax2 - ax1;
            double dy = ay2 - ay1;
            double len = Math.Sqrt(dx * dx + dy * dy);
            double nx = -dy / len * width / 2;
            double ny = dx / len * width / 2;
            return $"{PS(ax1 + nx, ay1 + ny)} {PS(ax2 + nx, ay2 + ny)} " +
                   $"{PS(ax2 - nx, ay2 - ny)} {PS(ax1 - nx, ay1 - ny)}";
        }

        double leftDX = input.P5.X - input.P1.X;
        double leftDY = input.P5.Y - input.P1.Y;
        double leftNorm = Math.Sqrt(leftDX * leftDX + leftDY * leftDY);
        double lux = leftDX / leftNorm;
        double luy = leftDY / leftNorm;

        double rightDX = input.P5.X - input.P2.X;
        double rightDY = input.P5.Y - input.P2.Y;
        double rightNorm = Math.Sqrt(rightDX * rightDX + rightDY * rightDY);
        double rux = rightDX / rightNorm;
        double ruy = rightDY / rightNorm;

        double ext = 0.3;
        double lx1 = solution.T1.X - lux * ext, ly1 = solution.T1.Y - luy * ext;
        double lx2 = solution.T2.X + lux * ext, ly2 = solution.T2.Y + luy * ext;
        double rx1 = solution.T3.X + rux * ext, ry1 = solution.T3.Y + ruy * ext;
        double rx2 = solution.T4.X - rux * ext, ry2 = solution.T4.Y - ruy * ext;

        var sb = new StringBuilder();
        sb.AppendLine($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{svgWidth}\" height=\"{svgHeight}\" viewBox=\"0 0 {svgWidth} {svgHeight}\">");
        sb.AppendLine("  <rect width=\"100%\" height=\"100%\" fill=\"white\"/>");

        sb.AppendLine($"  <polygon points=\"{BeamPolygon(input.P1.X, input.P1.Y, input.P2.X, input.P2.Y, input.H1)}\" fill=\"#5588DD\" stroke=\"#224488\" stroke-width=\"1.5\" opacity=\"0.85\"/>");
        sb.AppendLine($"  <polygon points=\"{BeamPolygon(input.P3.X, input.P3.Y, input.P4.X, input.P4.Y, input.H2)}\" fill=\"#5588DD\" stroke=\"#224488\" stroke-width=\"1.5\" opacity=\"0.85\"/>");
        sb.AppendLine($"  <polygon points=\"{BeamPolygon(lx1, ly1, lx2, ly2, input.H3)}\" fill=\"#FFD700\" stroke=\"#CC8800\" stroke-width=\"1.5\" opacity=\"0.85\"/>");
        sb.AppendLine($"  <polygon points=\"{BeamPolygon(rx1, ry1, rx2, ry2, input.H4)}\" fill=\"#FFD700\" stroke=\"#CC8800\" stroke-width=\"1.5\" opacity=\"0.85\"/>");

        void DashedLine(double wx1, double wy1, double wx2, double wy2, string color, string dash = "6,3")
        {
            var (sx1, sy1) = ToSvg(wx1, wy1);
            var (sx2, sy2) = ToSvg(wx2, wy2);
            sb.AppendLine($"  <line x1=\"{sx1:F1}\" y1=\"{sy1:F1}\" x2=\"{sx2:F1}\" y2=\"{sy2:F1}\" stroke=\"{color}\" stroke-width=\"1.2\" stroke-dasharray=\"{dash}\"/>");
        }

        DashedLine(input.P1.X - 0.8, input.P1.Y, input.P2.X + 0.8, input.P2.Y, "#224488");
        DashedLine(input.P3.X - 0.5, input.P3.Y, input.P4.X + 0.5, input.P4.Y, "#224488");
        DashedLine(lx1, ly1, lx2, ly2, "#CC8800");
        DashedLine(rx1, ry1, rx2, ry2, "#CC8800");
        DashedLine(input.P5.X, input.P1.Y, input.P5.X, input.P5.Y + 0.3, "#888888", "4,3");

        void Dot(double wx, double wy, string color, string label, string anchor = "middle", double dy = -10)
        {
            var (sx, sy) = ToSvg(wx, wy);
            sb.AppendLine($"  <circle cx=\"{sx:F1}\" cy=\"{sy:F1}\" r=\"5\" fill=\"{color}\" stroke=\"white\" stroke-width=\"1\"/>");
            if (label.Length > 0)
            {
                double lx = anchor == "end" ? sx - 8 : anchor == "start" ? sx + 8 : sx;
                sb.AppendLine($"  <text x=\"{lx:F1}\" y=\"{sy + dy:F1}\" font-size=\"13\" fill=\"{color}\" text-anchor=\"{anchor}\" font-weight=\"bold\">{label}</text>");
            }
        }

        Dot(input.P1.X, input.P1.Y, "#333333", "P1", "end");
        Dot(input.P2.X, input.P2.Y, "#333333", "P2", "start");
        Dot(input.P3.X, input.P3.Y, "#333333", "P3", "end");
        Dot(input.P4.X, input.P4.Y, "#333333", "P4", "start");
        Dot(input.P5.X, input.P5.Y, "#333333", "P5");

        Dot(solution.T1.X, solution.T1.Y, "#0055FF", "t1", "end");
        Dot(solution.T2.X, solution.T2.Y, "#0055FF", "t2");
        Dot(solution.T3.X, solution.T3.Y, "#0055FF", "t3", "start");
        Dot(solution.T4.X, solution.T4.Y, "#0055FF", "t4");

        Dot(solution.RedPoint.X, solution.RedPoint.Y, "#CC0000", "");
        Dot(0, input.H1 / 2.0, "#00AA00", "(0; h₁/2)", "start");
        Dot(input.P2.X, input.H1 / 2.0, "#00AA00", "(L; h₁/2)", "end");

        var (ds1, _) = ToSvg(input.P1.X, 0);
        var (ds2, _) = ToSvg(input.P2.X, 0);
        var (_, dsy) = ToSvg(0, input.P1.Y - 1.5);
        sb.AppendLine($"  <line x1=\"{ds1:F1}\" y1=\"{dsy - 5:F1}\" x2=\"{ds1:F1}\" y2=\"{dsy + 5:F1}\" stroke=\"#333\" stroke-width=\"1.5\"/>");
        sb.AppendLine($"  <line x1=\"{ds2:F1}\" y1=\"{dsy - 5:F1}\" x2=\"{ds2:F1}\" y2=\"{dsy + 5:F1}\" stroke=\"#333\" stroke-width=\"1.5\"/>");
        sb.AppendLine($"  <line x1=\"{ds1:F1}\" y1=\"{dsy:F1}\" x2=\"{ds2:F1}\" y2=\"{dsy:F1}\" stroke=\"#333\" stroke-width=\"1.5\"/>");
        double mx = (ds1 + ds2) / 2;
        double L = input.P2.X - input.P1.X;
        sb.AppendLine($"  <text x=\"{mx:F1}\" y=\"{dsy + 18:F1}\" font-size=\"12\" fill=\"#333\" text-anchor=\"middle\">L = {L:F1}</text>");

        sb.AppendLine($"  <text x=\"{svgWidth / 2}\" y=\"28\" font-size=\"16\" fill=\"#222\" text-anchor=\"middle\" font-weight=\"bold\">Geometric Element Positioning Solution</text>");
        string info = $"t1=({solution.T1.X:F3},{solution.T1.Y:F3})  t2=({solution.T2.X:F3},{solution.T2.Y:F3})  t3=({solution.T3.X:F3},{solution.T3.Y:F3})  t4=({solution.T4.X:F3},{solution.T4.Y:F3})";
        sb.AppendLine($"  <text x=\"{svgWidth / 2}\" y=\"{svgHeight - 8}\" font-size=\"11\" fill=\"#444\" text-anchor=\"middle\">{info}</text>");

        sb.AppendLine("</svg>");
        File.WriteAllText(path, sb.ToString());
    }
}
