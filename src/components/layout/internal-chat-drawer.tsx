"use client";

import { useEffect, useState, useRef } from "react";
import { MessageSquare, Send, X, Users, MessageCircleCode, Eye, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  sender_name: string;
  sender_role: string;
  recipient_role: string | null;
  content: string;
  created_at: string;
};

type ChatDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  branchId?: string;
  currentRole: string;
  currentName: string;
};

// Map roles to Arabic names
const roleNames: Record<string, string> = {
  organization_owner: "مدير المطعم",
  branch_manager: "مدير الفرع",
  cashier: "الكاشير",
  chef: "المطبخ / الشيف",
  inventory_manager: "المستودع / المخزون",
  staff: "الموظفين",
};

export function InternalChatDrawer({
  isOpen,
  onClose,
  orgId,
  branchId,
  currentRole,
  currentName,
}: ChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<"general" | "kitchen" | "pos" | "warehouse">("general");
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient() as any;

  const isManager = currentRole === "organization_owner" || currentRole === "branch_manager";

  // Scroll to bottom whenever messages list updates or tab changes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, activeTab]);

  useEffect(() => {
    if (!orgId) return;

    // 1. Fetch initial message history
    const fetchHistory = async () => {
      let query = supabase
        .from("internal_messages")
        .select("id, sender_name, sender_role, recipient_role, content, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true });

      // If branchId is specified, lock to branch
      if (branchId) {
        query = query.eq("branch_id", branchId);
      }

      const { data, error } = await query;
      if (data && !error) {
        setMessages(data as Message[]);
      }
    };

    fetchHistory();

    // 2. Subscribe to new PG inserts in Realtime
    const channel = supabase
      .channel("internal-messages-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "internal_messages",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload: any) => {
          const newMsg = payload.new as Message;
          
          // Verify if message belongs to this branch
          if (branchId && (payload.new as any).branch_id !== branchId) {
            return;
          }

          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, branchId, supabase]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const recipient = activeTab === "general" ? null : 
                     activeTab === "kitchen" ? "chef" : 
                     activeTab === "pos" ? "cashier" : 
                     "inventory_manager";

    const newMessageData = {
      organization_id: orgId,
      branch_id: branchId || null,
      sender_name: currentName,
      sender_role: currentRole,
      recipient_role: recipient,
      content: inputText.trim(),
    };

    const { error } = await supabase.from("internal_messages").insert(newMessageData);

    if (!error) {
      setInputText("");
    }
  };

  // Filter messages dynamically based on tab and dynamic permission (Manager sees all)
  const filteredMessages = messages.filter((msg) => {
    const isGeneral = msg.recipient_role === null;
    const isKitchen = msg.recipient_role === "chef";
    const isPos = msg.recipient_role === "cashier";
    const isWarehouse = msg.recipient_role === "inventory_manager";

    // 1. Manager oversight: sees every message in every channel
    if (isManager) {
      if (activeTab === "general") return isGeneral;
      if (activeTab === "kitchen") return isKitchen;
      if (activeTab === "pos") return isPos;
      if (activeTab === "warehouse") return isWarehouse;
    }

    // 2. Staff views: only show messages belonging to the channel AND they must have access
    // Kitchen staff (chef) can see Kitchen and General
    // POS staff (cashier) can see POS and General
    // Warehouse staff can see Warehouse and General
    const isStaffMember = 
      (currentRole === "chef" && (isKitchen || isGeneral)) ||
      (currentRole === "cashier" && (isPos || isGeneral)) ||
      (currentRole === "inventory_manager" && (isWarehouse || isGeneral)) ||
      (currentRole === "staff" && isGeneral);

    if (!isStaffMember && !isManager) return false;

    if (activeTab === "general") return isGeneral;
    if (activeTab === "kitchen") return isKitchen;
    if (activeTab === "pos") return isPos;
    if (activeTab === "warehouse") return isWarehouse;

    return false;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 start-0 z-50 w-full sm:w-96 bg-slate-900 border-e border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-left duration-300 text-slate-100">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-teal-400" />
          <h2 className="font-bold text-sm tracking-wide">المراسلة الداخلية الفورية</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-200">
          <X className="h-4.5 w-4.5" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-950/50 border-b border-slate-800/80 p-1 gap-1 shrink-0">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "general" ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          جروب المطعم
        </button>

        {/* Dynamic Channel rendering with access locks */}
        {(isManager || currentRole === "chef") && (
          <button
            onClick={() => setActiveTab("kitchen")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "kitchen" ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageCircleCode className="h-3.5 w-3.5" />
            المطبخ
          </button>
        )}

        {(isManager || currentRole === "cashier") && (
          <button
            onClick={() => setActiveTab("pos")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "pos" ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageCircleCode className="h-3.5 w-3.5" />
            الكاشير
          </button>
        )}

        {(isManager || currentRole === "inventory_manager") && (
          <button
            onClick={() => setActiveTab("warehouse")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "warehouse" ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageCircleCode className="h-3.5 w-3.5" />
            المستودع
          </button>
        )}
      </div>

      {/* Monitor Alert for Managers */}
      {isManager && (
        <div className="bg-teal-950/20 border-b border-teal-950/30 px-3 py-1.5 text-[10px] text-teal-400/90 flex items-center gap-1.5 shrink-0 justify-center">
          <Eye className="h-3 w-3" />
          <span>نمط الرقابة النشط: المدير يرى كل محادثات الأقسام الخاصة والعامة.</span>
        </div>
      )}

      {/* Message History list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 text-center">
            <MessageSquare className="h-10 w-10 text-slate-700 stroke-[1.5] mb-2" />
            <p className="text-xs font-medium">لا توجد رسائل في هذه القناة حالياً</p>
            <p className="text-[10px] text-slate-600 mt-1">ابدأ المحادثة الفورية وتواصل مع زملائك</p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.sender_name === currentName && msg.sender_role === currentRole;

            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${
                  isMe ? "ms-auto items-end" : "me-auto items-start"
                }`}
              >
                {/* Sender Title details */}
                <span className="text-[9px] text-slate-500 mb-1 px-1">
                  {msg.sender_name} ({roleNames[msg.sender_role] || msg.sender_role})
                </span>
                
                {/* Chat Bubble card */}
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm relative ${
                    isMe
                      ? "bg-teal-600 text-white rounded-te-none"
                      : "bg-slate-800 text-slate-100 rounded-ts-none border border-slate-750"
                  }`}
                >
                  <p className="whitespace-pre-line text-right">{msg.content}</p>
                  
                  {/* Timestamp & read confirmation */}
                  <span className="mt-1 flex items-center justify-end gap-1 text-[8px] text-slate-400/80">
                    {new Date(msg.created_at).toLocaleTimeString("ar-SA", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {isMe && <CheckCheck className="h-2.5 w-2.5 text-teal-300" />}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Form sender footer */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder={`اكتب رسالة في قناة ${
              activeTab === "general" ? "جروب المطعم" : 
              activeTab === "kitchen" ? "المطبخ" : 
              activeTab === "pos" ? "الكاشير" : "المستودع"
            }...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-slate-900 border-slate-800 text-slate-100 focus:border-teal-500/50 text-xs h-10 rounded-lg placeholder:text-slate-600"
            required
          />
          <Button type="submit" size="icon" className="h-10 w-10 bg-teal-600 hover:bg-teal-700 text-white">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
