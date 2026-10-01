'use client';
import { useParams } from 'next/navigation';
import TaskEditor from '@/components/forms/TaskEditor';

export default function TecnicoTarefa() {
  const { id } = useParams<{ id: string }>();
  return <TaskEditor taskId={id} role="technician" backHref="/tecnico" />;
}
