import { useState, useEffect } from "react";
import "./ChatHistory.css";
import { getChatHistory } from "@/lib/fetchUtils";

type Chat = {
    userMessage: string;
    botMessage: string;
};

const ChatHistory = () => {
    const [chatHistory, setChatHistory] = useState<Chat[]>([]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await getChatHistory();
                setChatHistory(history);
            } catch (error) {
                console.error("Error fetching chat history:", error);
            }
        };

        fetchHistory();
    }, []);

    return (
        <div className="chat-history">
            <h1>대화 기록</h1>
            {chatHistory.map((chat, index) => (
                <div key={index} className="chat-item">
                    <p>
                        <strong>사용자:</strong> {chat.userMessage}
                    </p>
                    <p>
                        <strong>컴퓨터:</strong> {chat.botMessage}
                    </p>
                </div>
            ))}
        </div>
    );
};

export default ChatHistory;
