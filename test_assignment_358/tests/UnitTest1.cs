using System;
using Xunit;
using GeometrySolver;

namespace GeometrySolver.Tests;

public class GeometryCalculatorTests
{
    private static GeometryInput DefaultInput() => new(
        P1: new Point(0, 0),
        P2: new Point(10, 0),
        P3: new Point(1, 6),
        P4: new Point(9, 6),
        P5: new Point(5, 9),
        H1: 1.0,
        H2: 1.0,
        H3: 0.8,
        H4: 0.8,
        A: 0.6
    );

    private const double Tolerance = 1e-6;

    [Fact]
    public void Solve_T1AndT3_AreOnBottomAxis()
    {
        var input = DefaultInput();
        var solution = GeometryCalculator.Solve(input);

        Assert.Equal(input.P1.Y, solution.T1.Y, Tolerance);
        Assert.Equal(input.P1.Y, solution.T3.Y, Tolerance);
    }

    [Fact]
    public void Solve_T2AndT4_AreOnTopAxis()
    {
        var input = DefaultInput();
        var solution = GeometryCalculator.Solve(input);

        Assert.Equal(input.P3.Y, solution.T2.Y, Tolerance);
        Assert.Equal(input.P3.Y, solution.T4.Y, Tolerance);
    }

    [Fact]
    public void Solve_LeftUpperEdge_PassesThroughGreenPointAtX0()
    {
        var input = DefaultInput();
        var solution = GeometryCalculator.Solve(input);

        double upperEdgeY = GeometryCalculator.UpperEdgeYAtX(
            solution.LeftSlope, solution.LeftIntercept, input.H3 / 2.0, 0);

        Assert.Equal(input.H1 / 2.0, upperEdgeY, Tolerance);
    }

    [Fact]
    public void Solve_RightUpperEdge_PassesThroughGreenPointAtXL()
    {
        var input = DefaultInput();
        var solution = GeometryCalculator.Solve(input);

        double upperEdgeY = GeometryCalculator.UpperEdgeYAtX(
            solution.RightSlope, solution.RightIntercept, input.H4 / 2.0, input.P2.X);

        Assert.Equal(input.H1 / 2.0, upperEdgeY, Tolerance);
    }

    [Fact]
    public void Solve_T2AndT4_AreSymmetricAroundP5()
    {
        var input = DefaultInput();
        var solution = GeometryCalculator.Solve(input);

        double distLeft = input.P5.X - solution.T2.X;
        double distRight = solution.T4.X - input.P5.X;

        Assert.Equal(distLeft, distRight, Tolerance);
    }

    [Fact]
    public void Solve_RedPoint_IsAtCorrectPosition()
    {
        var input = DefaultInput();
        var solution = GeometryCalculator.Solve(input);

        Assert.Equal(input.P5.X, solution.RedPoint.X, Tolerance);
        Assert.Equal(input.P3.Y - input.H2 / 2.0, solution.RedPoint.Y, Tolerance);
    }

    [Fact]
    public void Solve_T1AndT3_AreSymmetricAroundMidpoint()
    {
        var input = DefaultInput();
        var solution = GeometryCalculator.Solve(input);

        double mid = (input.P1.X + input.P2.X) / 2.0;
        double distLeft = mid - solution.T1.X;
        double distRight = solution.T3.X - mid;

        Assert.Equal(distLeft, distRight, Tolerance);
    }

    [Fact]
    public void IntersectWithHorizontal_ReturnsCorrectPoint()
    {
        double slope = 2.0;
        double intercept = 1.0;
        double y = 5.0;

        var point = GeometryCalculator.IntersectWithHorizontal(slope, intercept, y);

        Assert.Equal(y, point.Y, Tolerance);
        Assert.Equal(slope * point.X + intercept, y, Tolerance);
    }

    [Fact]
    public void Solve_WithSymmetricGeometry_YieldsSymmetricSolution()
    {
        var input = new GeometryInput(
            P1: new Point(0, 0),
            P2: new Point(10, 0),
            P3: new Point(1, 6),
            P4: new Point(9, 6),
            P5: new Point(5, 9),
            H1: 1.0,
            H2: 1.0,
            H3: 0.8,
            H4: 0.8,
            A: 0.6
        );

        var solution = GeometryCalculator.Solve(input);

        double L = input.P2.X - input.P1.X;
        Assert.Equal(L - solution.T3.X, solution.T1.X, Tolerance);
        Assert.Equal(L - solution.T4.X, solution.T2.X, Tolerance);
    }

    [Fact]
    public void SvgRenderer_GeneratesFile()
    {
        var input = DefaultInput();
        var solution = GeometryCalculator.Solve(input);
        string path = System.IO.Path.GetTempFileName() + ".svg";

        SvgRenderer.Generate(path, input, solution);

        Assert.True(System.IO.File.Exists(path));
        string content = System.IO.File.ReadAllText(path);
        Assert.Contains("<svg", content);
        Assert.Contains("</svg>", content);
        System.IO.File.Delete(path);
    }
}
