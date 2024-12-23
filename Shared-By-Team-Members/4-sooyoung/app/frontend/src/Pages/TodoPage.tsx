import React, { useState, useEffect } from "react";
import "./TodoPage.css";
import { FaPlusCircle } from "react-icons/fa"; // 플러스 아이콘 사용
import { fetchFromFunctionApp } from "@/lib/fetchUtils";

type Todo = {
    id: number;
    text: string;
    completed: boolean;
};

// 환경 변수에서 URL 가져오기
const SET_SCHEDULE_URL = import.meta.env.VITE_AZURE_FA_SET_SCHEDULE_URL!;
const HANDLE_SCHEDULE_URL = import.meta.env.VITE_AZURE_FA_HANDLE_SCHEDULE_WITH_GPT_URL!;

export default function TodoPage() {
    const [filter, setFilter] = useState<"incomplete" | "completed" | "all">("incomplete"); // 필터 상태
    const [todos, setTodos] = useState<Todo[]>([]);
    const [showInput, setShowInput] = useState(false); // 입력창 표시 상태
    const [newTodo, setNewTodo] = useState(""); // 새 할 일 내용
    const [error, setError] = useState<string | null>(null); // Add error state
    const [loading, setLoading] = useState(true); // Add loading state

    // const jsonTodos = JSON.stringify(todos, null, 2); // JSON 형식으로 변환
    // console.log(jsonTodos);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 서버에 스케줄 데이터 저장
                const schedulePayload = {
                    schedule: todos.map(todo => ({ id: todo.id, text: todo.text, completed: todo.completed }))
                };
                console.log("프론트엔드 요청 데이터 (스케줄 저장):", JSON.stringify(schedulePayload, null, 2));

                const set_schedule_response = await fetchFromFunctionApp(SET_SCHEDULE_URL, "POST", {
                    schedule: todos.map(todo => ({ id: todo.id, text: todo.text, completed: todo.completed }))
                });
                console.log("백엔드 응답 데이터 (스케줄 저장):", set_schedule_response);

                // 저장된 데이터를 GPT 모델로 처리
                const gptPayload = { schedule: set_schedule_response };
                console.log("GPT 모델 요청 데이터:", JSON.stringify(gptPayload, null, 2));

                const scheduleData = await fetchFromFunctionApp(HANDLE_SCHEDULE_URL, "POST", {
                    schedule: set_schedule_response
                });
                console.log("스케줄 데이터 처리 결과:", scheduleData);
            } catch (err) {
                console.error("API 호출 에러:", err);
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [todos]); // todos가 변경될 때마다 데이터 fetch

    if (loading) return <p>로딩 중...</p>;
    if (error) return <p>오류 발생: {error}</p>;

    const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setFilter(event.target.value as "incomplete" | "completed" | "all");
    };

    const handleCheckboxChange = (id: number) => {
        setTodos(prevTodos => prevTodos.map(todo => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)));
    };

    const handleAddTodo = () => {
        if (newTodo.trim() === "") return; // 빈 입력 방지
        setTodos(prevTodos => [...prevTodos, { id: Date.now(), text: newTodo, completed: false }]);
        setNewTodo("");
        setShowInput(false); // 입력창 닫기
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            handleAddTodo(); // 엔터키로 할 일 추가
        }
    };

    // 필터에 따라 할 일 목록 필터링
    const filteredTodos = todos.filter(todo => {
        if (filter === "incomplete") {
            return !todo.completed; // 미완료 항목만 필터링
        } else if (filter === "completed") {
            return todo.completed; // 완료 항목만 필터링
        } else {
            return true; // 전체 항목 보기
        }
    });

    return (
        <div className="todo-page">
            <h1 className="todo-header">할 일</h1>

            <div className="filter-section">
                <select className="filter-select" value={filter} onChange={handleFilterChange}>
                    <option value="incomplete">나의 일정</option>
                    <option value="completed">완료된 일정</option>
                    <option value="all">모두 보기</option>
                </select>
            </div>

            <div className="todo-list">
                <span className="add-icon" onClick={() => setShowInput(!showInput)}>
                    <FaPlusCircle />
                </span>

                {showInput && (
                    <div className="todo-input">
                        <input
                            type="text"
                            placeholder="새 할 일을 입력하세요"
                            value={newTodo}
                            onChange={e => setNewTodo(e.target.value)}
                            onKeyDown={handleKeyPress} // 엔터키 이벤트 추가
                            className="filter-select"
                        />
                        <button onClick={handleAddTodo} className="add-todo-button">
                            추가
                        </button>
                    </div>
                )}
                {filteredTodos.map(todo => (
                    <div key={todo.id} className="todo-item">
                        <label className="todo-label">
                            <input type="checkbox" checked={todo.completed} onChange={() => handleCheckboxChange(todo.id)} />
                            <span className={`todo-text ${todo.completed ? "completed" : ""}`}>{todo.text}</span>
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
}
