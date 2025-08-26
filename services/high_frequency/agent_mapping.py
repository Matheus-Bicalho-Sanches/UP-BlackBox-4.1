"""
Mapeamento de códigos de agente para nomes de corretoras
Baseado na tabela fornecida pelo usuário
"""

AGENT_MAPPING = {
    3: "XP",
    4: "Alfa",
    8: "UBS",
    9: "Deutsche",
    10: "Spinelli",
    13: "Merril",
    15: "Guide",
    16: "JP Morgan",
    21: "Votorantim",
    23: "Necton",
    27: "Santander",
    39: "Agora",
    40: "Morgan",
    45: "Credit",
    58: "Socopa",
    59: "Safra",
    63: "NovInvest",
    72: "Bradesco",
    74: "Coinvalores",
    77: "Citigroup",
    83: "Master",
    85: "BTG",
    88: "CM Capital",
    90: "NuInvest",
    92: "Elliot",
    93: "Nova Futura",
    106: "Mercantil",
    107: "Terra",
    114: "Itau",
    115: "Commcor",
    120: "Genial",
    122: "BGC",
    127: "Tullet",
    129: "Planner",
    131: "Fator",
    147: "Ativa",
    172: "Banrisul",
    174: "Elite",
    177: "Solidus",
    186: "Geral",
    187: "Sita",
    190: "Warren",
    191: "Senso",
    206: "Banco JP",
    226: "Amaril",
    227: "Gradual",
    234: "Codepe",
    238: "Goldman",
    251: "BNP",
    254: "BB",
    262: "Mirae",
    298: "Citibank",
    304: "Safra",
    308: "Clear",
    346: "Daycoval",
    370: "Traderace",
    386: "Rico",
    688: "ABN",
    735: "ICAP",
    746: "LEV",
    833: "Credit",
    1026: "BTG",
    1081: "Banco Seguro",
    1089: "RB Capital",
    1099: "Inter",
    1130: "StoneX",
    1618: "Ideal",
    1850: "Sicredi",
    1855: "Vitreo",
    1953: "Sicoob",
    1982: "Modal",
    2028: "Itau",
    2659: "BB",
    3701: "Órama",
    4015: "Galapagos",
    4090: "Toro",
    6003: "C6",
    7029: "PicPay",
    7035: "Paginvest",
    7078: "Scotiabank",
    811675: "TC BR"
}

def get_agent_name(agent_id: int) -> str:
    """
    Retorna o nome da corretora baseado no código do agente
    
    Args:
        agent_id (int): Código do agente
        
    Returns:
        str: Nome da corretora ou código original se não encontrado
    """
    return AGENT_MAPPING.get(agent_id, str(agent_id))

def get_agent_id_by_name(name: str) -> int:
    """
    Retorna o código do agente baseado no nome da corretora
    
    Args:
        name (str): Nome da corretora
        
    Returns:
        int: Código do agente ou None se não encontrado
    """
    for agent_id, agent_name in AGENT_MAPPING.items():
        if agent_name.lower() == name.lower():
            return agent_id
    return None
