import React, { useState } from "react";
import "./TodoPage.css";
import { FaPlusCircle } from "react-icons/fa";

type Todo = {
    id: number;
    text: string;
    completed: boolean;
};

function TodoPage() {
    const [filter, setFilter] = useState<"incomplete" | "completed" | "all">("incomplete");
    // const [showInput, setShowInput] = useState(false); // 입력창 표시 상태
    const [todos, setTodos] = useState<Todo[]>([
        { id: 1, text: "25일 산타친구 방문", completed: true },
        { id: 2, text: "26일 MS 2차모임", completed: false },
        { id: 3, text: "매일) 20:30 산책", completed: false },
        { id: 4, text: "평일) 07:00 기상", completed: false }
    ]);
    const [newTodo, setNewTodo] = useState("");

    const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setFilter(event.target.value as "all" | "completed" | "incomplete");
    };

    const handleCheckboxChange = (id: number) => {
        setTodos(prevTodos => prevTodos.map(todo => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)));
    };

    const handleAddTodo = () => {
        if (newTodo.trim() === "") return;
        setTodos(prevTodos => [...prevTodos, { id: Date.now(), text: newTodo, completed: false }]);
        setNewTodo("");
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            handleAddTodo(); // 엔터키로 할 일 추가
        }
    };

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
                <div className="todo-input">
                    <input
                        type="text"
                        placeholder="새 할 일을 입력하세요"
                        value={newTodo}
                        onChange={e => setNewTodo(e.target.value)}
                        onKeyDown={handleKeyPress} // 엔터키 이벤트 추가
                        className="filter-select"
                    />
                    <span className="add-icon" onClick={handleAddTodo}>
                        <FaPlusCircle />
                    </span>
                </div>
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

export default TodoPage;
