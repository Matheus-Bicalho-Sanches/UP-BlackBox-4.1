using System.Runtime.InteropServices;

namespace MarketCollector.DataTypes;

/// <summary>
/// Estrutura de identificação de ativo (versão antiga, usada em alguns callbacks)
/// </summary>
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct TAssetID
{
    [MarshalAs(UnmanagedType.LPWStr)]
    public string Ticker;

    [MarshalAs(UnmanagedType.LPWStr)]
    public string Bolsa;

    public int Feed;

    public override string ToString() => $"{Ticker}:{Bolsa}";
}
