import React from "react";
import "./Users.css";

/**
 * Reusable Detail row component for UserModal or any detail grid
 *
 * Props:
 * - label: string, the field label
 * - children: the field value or input element
 */
const Detail = ({ label, children }) => (
  <div className="detail-row">
    <div className="detail-label">{label}</div>
    <div className="detail-value">{children}</div>
  </div>
);

export default Detail;
