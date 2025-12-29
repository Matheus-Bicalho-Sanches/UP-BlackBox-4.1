using System;
using System.Runtime.InteropServices;

namespace Up5TickCollector.DataTypes;

/// <summary>
/// Estrutura de data/hora do Windows (usada pela DLL)
/// </summary>
[StructLayout(LayoutKind.Sequential)]
public struct SystemTime
{
    public ushort Year;
    public ushort Month;
    public ushort DayOfWeek;
    public ushort Day;
    public ushort Hour;
    public ushort Minute;
    public ushort Second;
    public ushort Milliseconds;

    public DateTime ToDateTime()
    {
        try
        {
            return new DateTime(Year, Month, Day, Hour, Minute, Second, Milliseconds, DateTimeKind.Utc);
        }
        catch
        {
            return DateTime.MinValue;
        }
    }
}

