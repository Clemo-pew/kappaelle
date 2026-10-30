import { TaskForm } from "../../task-form";
import { getClients, getEmployees } from "../../data";

export default async function NewTaskPage() {
  const [clients, employees] = await Promise.all([getClients(), getEmployees()]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Nuovo task</h1>
      <TaskForm clients={clients} employees={employees} />
    </div>
  );
}
