import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { apiRequest } from "../api";
import "./Activities.css";

function Activities() {
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userType = sessionStorage.getItem("user_type");
    const familyId = sessionStorage.getItem("family_id");

    // if (!userType) {
    //   navigate("/");
    //   return;
    // }

    let url = process.env.REACT_APP_API_URL_BASE + "/activities/";
    if (userType === "customer" && familyId) {
      url = `${url}family/${familyId}/`;
    }

    apiRequest(url)
      .then((res) => res.json())
      .then((data) => {
        const events = data.map((activity) => ({
          id: activity.activity_id,
          title: activity.activity_description,
          start: activity.from_date,
          end: activity.to_date,
          extendedProps: {
            family: activity.family.family_name,
            createdBy: `${activity.created_by.first_name} ${activity.created_by.last_name}`,
            isActive: activity.is_active,
            createdDate: activity.created_date,
          },
        }));
        setActivities(events);
      })
      .catch((err) => console.error("Error fetching activities:", err));
  }, [navigate]);

  const handleEventClick = (info) => {
    setSelectedActivity(info.event);
  };

  const closeModal = () => setSelectedActivity(null);

  return (
    <div className="activities-page">
      <div className="calendar-wrapper">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          events={activities}
          eventClick={handleEventClick}
          height="auto"       // let calendar size to content
          expandRows={false}  // do not force extra rows
        />
      </div>

      {selectedActivity && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Activity Details</h2>
            <p><strong>Title:</strong> {selectedActivity.title}</p>
            <p><strong>Family:</strong> {selectedActivity.extendedProps.family}</p>
            <p><strong>Created By:</strong> {selectedActivity.extendedProps.createdBy}</p>
            <p><strong>From:</strong> {new Date(selectedActivity.start).toLocaleString()}</p>
            <p><strong>To:</strong> {new Date(selectedActivity.end).toLocaleString()}</p>
            <p><strong>Active:</strong> {selectedActivity.extendedProps.isActive ? "Yes" : "No"}</p>
            <button onClick={closeModal}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Activities;
