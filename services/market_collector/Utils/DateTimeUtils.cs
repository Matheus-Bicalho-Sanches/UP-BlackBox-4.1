using System;

namespace MarketCollector.Utils;

/// <summary>
/// Utilitários para conversão de datas/timestamps
/// </summary>
public static class DateTimeUtils
{
    /// <summary>
    /// Converte DateTime UTC para epoch float64 (segundos desde 1970-01-01 UTC, com fração para milissegundos)
    /// </summary>
    public static double ToEpochFloat64(DateTime dateTime)
    {
        if (dateTime.Kind != DateTimeKind.Utc)
        {
            dateTime = dateTime.ToUniversalTime();
        }

        var epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var timeSpan = dateTime - epoch;
        return timeSpan.TotalSeconds;
    }

    /// <summary>
    /// Converte string de data da DLL (formato "dd/MM/yyyy HH:mm:ss.fff" ou "dd/MM/yyyy HH:mm:ss") para epoch float64
    /// </summary>
    public static double ParseProfitDateTime(string dateString)
    {
        if (string.IsNullOrWhiteSpace(dateString))
        {
            return ToEpochFloat64(DateTime.UtcNow);
        }

        try
        {
            // Tenta parse com milissegundos
            if (DateTime.TryParseExact(dateString, "dd/MM/yyyy HH:mm:ss.fff", 
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AssumeLocal,
                out DateTime dateTime))
            {
                return ToEpochFloat64(dateTime);
            }

            // Tenta parse sem milissegundos
            if (DateTime.TryParseExact(dateString, "dd/MM/yyyy HH:mm:ss",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AssumeLocal,
                out dateTime))
            {
                return ToEpochFloat64(dateTime);
            }

            // Fallback: tenta parse genérico
            if (DateTime.TryParse(dateString, out dateTime))
            {
                return ToEpochFloat64(dateTime);
            }
        }
        catch
        {
            // Se falhar, retorna agora
        }

        return ToEpochFloat64(DateTime.UtcNow);
    }
}
