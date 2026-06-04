using System;

namespace GeometrySolver;

public record Point(double X, double Y);

public record GeometryInput(
    Point P1, Point P2, Point P3, Point P4, Point P5,
    double H1, double H2, double H3, double H4, double A);

public record GeometrySolution(
    Point T1, Point T2, Point T3, Point T4,
    double LeftSlope, double LeftIntercept,
    double RightSlope, double RightIntercept,
    Point RedPoint);

public static class GeometryCalculator
{
    public static GeometrySolution Solve(GeometryInput input)
    {
        double leftSlope = (input.P5.Y - input.P1.Y) / (input.P5.X - input.P1.X);
        double rightSlope = (input.P5.Y - input.P2.Y) / (input.P5.X - input.P2.X);

        double sqrtLeft = Math.Sqrt(1 + leftSlope * leftSlope);
        double sqrtRight = Math.Sqrt(1 + rightSlope * rightSlope);

        double bLeft = input.H1 / 2.0 - (input.H3 / 2.0) * sqrtLeft;
        double bUpperRight = input.H1 / 2.0 - rightSlope * input.P2.X;
        double bRight = bUpperRight - (input.H4 / 2.0) * sqrtRight;

        Point t1 = IntersectWithHorizontal(leftSlope, bLeft, input.P1.Y);
        Point t2 = IntersectWithHorizontal(leftSlope, bLeft, input.P3.Y);
        Point t3 = IntersectWithHorizontal(rightSlope, bRight, input.P1.Y);
        Point t4 = IntersectWithHorizontal(rightSlope, bRight, input.P3.Y);

        Point redPoint = new(input.P5.X, input.P3.Y - input.H2 / 2.0);

        return new GeometrySolution(t1, t2, t3, t4, leftSlope, bLeft, rightSlope, bRight, redPoint);
    }

    public static Point IntersectWithHorizontal(double slope, double intercept, double y)
    {
        double x = (y - intercept) / slope;
        return new Point(x, y);
    }

    public static double UpperEdgeYAtX(double slope, double intercept, double halfWidth, double x)
    {
        double sqrtFactor = Math.Sqrt(1 + slope * slope);
        return slope * x + intercept + halfWidth * sqrtFactor;
    }
}
