import{r,j as e}from"./index-f8gYbhCl.js";function x(){const[i,n]=r.useState([]),[l,d]=r.useState(!0),[c,m]=r.useState(null);r.useEffect(()=>{f()},[]);const f=async()=>{try{const s=await fetch("/api/tasks/assigned",{credentials:"include"});if(!s.ok)throw new Error("Failed to fetch tasks.");const t=await s.json();n(t)}catch(s){m(s.message)}finally{d(!1)}},h=async(s,t)=>{try{const a=await fetch(`/api/tasks/${s}/status`,{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({status:t})});if(!a.ok)throw new Error("Failed to update status.");const p=await a.json();n(u=>u.map(o=>o._id===s?{...o,status:p.status}:o))}catch(a){console.error(a)}};return e.jsxs("div",{className:"container",children:[e.jsx("h1",{children:"Paralegal Task Center"}),e.jsx("p",{className:"subtitle",children:"Manage your assigned legal tasks efficiently."}),l?e.jsx("p",{className:"info",children:"Loading tasks..."}):c?e.jsxs("p",{className:"error",children:["Error: ",c]}):i.length===0?e.jsx("p",{className:"info",children:"No tasks assigned yet."}):e.jsx("div",{className:"task-list",children:i.map(s=>e.jsxs("div",{className:"task-card",children:[e.jsxs("div",{className:"task-header",children:[e.jsx("h3",{children:s.title}),e.jsx("span",{className:`status ${s.status.toLowerCase().replace(" ","-")}`,children:s.status})]}),e.jsx("p",{className:"desc",children:s.description}),e.jsxs("div",{className:"task-actions",children:[e.jsx("label",{children:"Change Status:"}),e.jsxs("select",{value:s.status,onChange:t=>h(s._id,t.target.value),children:[e.jsx("option",{children:"To Do"}),e.jsx("option",{children:"In Progress"}),e.jsx("option",{children:"Completed"})]})]})]},s._id))}),e.jsx("style",{children:`
        .container {
          min-height: 100vh;
          padding: 2rem;
          background: linear-gradient(to bottom right, #e8f0ff, #f7f9fc);
          font-family: 'Segoe UI', sans-serif;
          color: #1f2937;
        }

        h1 {
          font-size: 2.2rem;
          margin-bottom: 0.25rem;
        }

        .subtitle {
          font-size: 1rem;
          color: #6b7280;
          margin-bottom: 2rem;
        }

        .info {
          font-size: 1rem;
          color: #374151;
        }

        .error {
          color: #dc2626;
          font-weight: 500;
        }

        .task-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .task-card {
          background: #ffffff;
          border-radius: 10px;
          padding: 1.5rem;
          box-shadow: 0 8px 20px rgba(0,0,0,0.06);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .task-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .task-header h3 {
          font-size: 1.1rem;
          margin: 0;
        }

        .status {
          padding: 0.25rem 0.6rem;
          font-size: 0.75rem;
          border-radius: 9999px;
          color: white;
          font-weight: 500;
          text-transform: capitalize;
        }

        .status.to-do {
          background-color: #3b82f6;
        }

        .status.in-progress {
          background-color: #f59e0b;
        }

        .status.completed {
          background-color: #10b981;
        }

        .desc {
          font-size: 0.95rem;
          color: #4b5563;
          margin: 0.5rem 0 1rem;
          line-height: 1.5;
        }

        .task-actions {
          display: flex;
          flex-direction: column;
        }

        .task-actions label {
          font-size: 0.85rem;
          color: #6b7280;
          margin-bottom: 0.25rem;
        }

        .task-actions select {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: #f9fafb;
          font-size: 0.95rem;
        }

        @media (max-width: 480px) {
          h1 {
            font-size: 1.6rem;
          }
        }
      `})]})}export{x as default};
