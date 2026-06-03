using System;
using System.IO;
using System.Text;
using GeometrySolver;

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

Console.WriteLine("=== Input Parameters ===");
Console.WriteLine($"P1=({input.P1.X},{input.P1.Y})  P2=({input.P2.X},{input.P2.Y})  " +
                  $"P3=({input.P3.X},{input.P3.Y})  P4=({input.P4.X},{input.P4.Y})  P5=({input.P5.X},{input.P5.Y})");
Console.WriteLine($"h1={input.H1}  h2={input.H2}  h3={input.H3}  h4={input.H4}  a={input.A}");
Console.WriteLine();
Console.WriteLine("=== Computed Axes ===");
Console.WriteLine($"Left axis:  y = {solution.LeftSlope:F4}x + {solution.LeftIntercept:F4}");
Console.WriteLine($"Right axis: y = {solution.RightSlope:F4}x + {solution.RightIntercept:F4}");
Console.WriteLine();
Console.WriteLine("=== Intersection Points (Answer) ===");
Console.WriteLine($"t1 = ({solution.T1.X:F4}, {solution.T1.Y:F4})");
Console.WriteLine($"t2 = ({solution.T2.X:F4}, {solution.T2.Y:F4})");
Console.WriteLine($"t3 = ({solution.T3.X:F4}, {solution.T3.Y:F4})");
Console.WriteLine($"t4 = ({solution.T4.X:F4}, {solution.T4.Y:F4})");
Console.WriteLine();
Console.WriteLine("=== Reference Points ===");
Console.WriteLine($"Red point = ({solution.RedPoint.X:F4}, {solution.RedPoint.Y:F4})");
Console.WriteLine($"Green point left  = (0, {input.H1 / 2:F4})");
Console.WriteLine($"Green point right = ({input.P2.X}, {input.H1 / 2:F4})");

string svgPath = "output.svg";
SvgRenderer.Generate(svgPath, input, solution);
Console.WriteLine();
Console.WriteLine($"SVG saved to {svgPath}");
