using System;
using System.IO;

namespace MarketCollector.Utils;

/// <summary>
/// Utilitário para encontrar o caminho da ProfitDLL.dll
/// </summary>
public static class DllPathResolver
{
    /// <summary>
    /// Tenta encontrar a ProfitDLL.dll em vários locais comuns
    /// </summary>
    public static string? FindDllPath(string? configuredPath = null)
    {
        // Se já configurado e existe, usa
        if (!string.IsNullOrWhiteSpace(configuredPath) && File.Exists(configuredPath))
        {
            return Path.GetFullPath(configuredPath);
        }

        var currentDir = Directory.GetCurrentDirectory();
        var candidates = new List<string>();

        // 1. Caminho configurado no diretório atual
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            candidates.Add(Path.Combine(currentDir, configuredPath));
        }

        // 2. Mesmo diretório do executável
        candidates.Add(Path.Combine(currentDir, "ProfitDLL.dll"));
        candidates.Add(Path.Combine(currentDir, "ProfitDLL64.dll"));

        // 3. Procurar no workspace root (Dll_Profit/DLLs/Win64/)
        var searchDir = currentDir;
        for (int i = 0; i < 5; i++) // Limita busca até 5 níveis acima
        {
            var dllPaths = new[]
            {
                Path.Combine(searchDir, "Dll_Profit", "DLLs", "Win64", "ProfitDLL.dll"),
                Path.Combine(searchDir, "Dll_Profit", "bin", "Win64", "Example", "ProfitDLL64.dll"),
                Path.Combine(searchDir, "Dll_Profit", "ProfitDLL.dll"),
                Path.Combine(searchDir, "Dll_Profit", "ProfitDLL64.dll"),
            };

            foreach (var dllPath in dllPaths)
            {
                if (File.Exists(dllPath))
                {
                    return Path.GetFullPath(dllPath);
                }
            }

            var parent = Directory.GetParent(searchDir);
            if (parent == null) break;
            searchDir = parent.FullName;
        }

        // 4. Caminhos relativos comuns
        var relativePaths = new[]
        {
            Path.Combine("..", "..", "Dll_Profit", "DLLs", "Win64", "ProfitDLL.dll"),
            Path.Combine("..", "Dll_Profit", "DLLs", "Win64", "ProfitDLL.dll"),
        };

        foreach (var relPath in relativePaths)
        {
            var fullPath = Path.GetFullPath(Path.Combine(currentDir, relPath));
            if (File.Exists(fullPath))
            {
                return fullPath;
            }
        }

        return null; // Não encontrado
    }
}




