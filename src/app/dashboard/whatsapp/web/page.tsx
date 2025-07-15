"use client";
import React, { useState } from "react";

interface Conversation {
  id: number;
  name: string;
  avatar?: string;
  lastMessage: string;
  time: string;
}

interface Message {
  id: number;
  sender: "me" | "other";
  content: string;
  time: string;
}

const mockConversations: Conversation[] = [
  {
    id: 1,
    name: "João Silva",
    lastMessage: "Até logo!",
    time: "09:30",
  },
  {
    id: 2,
    name: "Maria Souza",
    lastMessage: "Muito obrigado!",
    time: "Ontem",
  },
  {
    id: 3,
    name: "Grupo Família",
    lastMessage: "Ok",
    time: "Ontem",
  },
];

const initialMessages: Record<number, Message[]> = {
  1: [
    { id: 1, sender: "other", content: "Olá! Tudo bem?", time: "09:00" },
    { id: 2, sender: "me", content: "Tudo ótimo e você?", time: "09:05" },
    { id: 3, sender: "other", content: "Até logo!", time: "09:30" },
  ],
  2: [
    { id: 1, sender: "other", content: "Pedido enviado, obrigado!", time: "Ontem" },
    { id: 2, sender: "me", content: "Perfeito, à disposição.", time: "Ontem" },
  ],
  3: [
    {
      id: 1,
      sender: "other",
      content: "Alguém pode mandar o endereço?",
      time: "Ontem",
    },
  ],
};

export default function WhatsAppWebPage() {
  const [conversations] = useState<Conversation[]>(mockConversations);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<
    number,
    Message[]
  >>(initialMessages);
  const [selectedId, setSelectedId] = useState<number | null>(conversations[0]?.id ?? null);
  const [newMessage, setNewMessage] = useState("");

  const selectedMessages =
    (selectedId && messagesByConversation[selectedId]) || [];
  const selectedConversation = conversations.find((c) => c.id === selectedId);

  const handleSend = () => {
    if (!selectedId || newMessage.trim() === "") return;
    const updated = { ...messagesByConversation };
    const nextId =
      (updated[selectedId]?.[updated[selectedId].length - 1]?.id || 0) + 1;
    updated[selectedId] = [
      ...updated[selectedId],
      { id: nextId, sender: "me", content: newMessage, time: "Agora" },
    ];
    setMessagesByConversation(updated);
    setNewMessage("");
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden flex h-[75vh]">
      {/* Conversations list */}
      <div className="w-1/3 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <input
            type="text"
            placeholder="Pesquisar..."
            className="w-full bg-gray-700 text-sm text-gray-200 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-700">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedId(conv.id)}
              className={`w-full flex items-center px-4 py-3 hover:bg-gray-700 text-left transition-colors duration-200 ${
                conv.id === selectedId ? "bg-gray-700" : ""
              }`}
            >
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-200">{conv.name}</span>
                  <span className="text-xs text-gray-400">{conv.time}</span>
                </div>
                <p className="text-sm text-gray-400 truncate max-w-full">
                  {conv.lastMessage}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center">
          {selectedConversation ? (
            <>
              <span className="font-medium text-gray-200">
                {selectedConversation.name}
              </span>
            </>
          ) : (
            <span className="text-gray-400">Selecione uma conversa</span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-900">
          {selectedConversation ? (
            selectedMessages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-xs md:max-w-md lg:max-w-lg break-words p-3 rounded-lg text-sm shadow ${
                  msg.sender === "me"
                    ? "bg-cyan-600 text-white self-end"
                    : "bg-gray-700 text-gray-200 self-start"
                }`}
              >
                {msg.content}
              </div>
            ))
          ) : (
            <div className="text-gray-400">Nenhuma conversa selecionada.</div>
          )}
        </div>

        {/* Input */}
        {selectedConversation && (
          <div className="px-4 py-3 border-t border-gray-700 flex items-center space-x-3 bg-gray-800">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-gray-700 text-gray-200 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <button
              onClick={handleSend}
              className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded transition-colors"
            >
              Enviar
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 