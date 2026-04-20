import React from "react";
import BaseModal from "./BaseModal";

export default function ViewAnswerModal({ isOpen, onClose, question, answer }) {
  if (!question) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Answer Details">
      <div style={{ marginBottom: "0.75rem" }}>
        <strong>Question</strong>
        <div style={{ fontSize: "0.9rem", color: "#555" }}>
          {question.question}
        </div>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <strong>Answer</strong>
        <div style={{ fontSize: "0.9rem" }}>
          {answer ?? "No answer provided"}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <button onClick={onClose}>Close</button>
      </div>
    </BaseModal>
  );
}
