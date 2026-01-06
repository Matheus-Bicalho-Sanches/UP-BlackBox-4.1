using System.Runtime.InteropServices;

namespace MarketCollector.DataTypes;

/// <summary>
/// Estrutura de identificação de ativo (versão moderna, usada em callbacks V2)
/// </summary>
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct TConnectorAssetIdentifier
{
    public byte Version;
    
    [MarshalAs(UnmanagedType.LPWStr)]
    public string Ticker;
    
    [MarshalAs(UnmanagedType.LPWStr)]
    public string Exchange;
    
    public byte FeedType;

    public override string ToString() => $"{Ticker}:{Exchange}";
}
