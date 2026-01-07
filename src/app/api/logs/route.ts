import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Interface para representar um log de tarefa
interface TaskLog {
  id?: string;
  action: string;
  taskId: string;
  taskTitle: string;
  taskType: string;
  dateTime: string;
  user: string;
  details: string;
}

// Referência para a coleção de logs de tarefas
const logsCollection = adminDb.collection('taskLogs');

// GET - Obter todos os logs de tarefas
export async function GET(request: NextRequest) {
  try {
    // Buscar todos os logs ordenados por data/hora (mais recentes primeiro)
    const snapshot = await logsCollection.orderBy('dateTime', 'desc').get();
    
    if (snapshot.empty) {
      return NextResponse.json({ logs: [] }, { status: 200 });
    }
    
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as TaskLog[];
    
    return NextResponse.json({ logs }, { status: 200 });
  } catch (error) {
    console.error('Erro ao obter logs:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar logs' },
      { status: 500 }
    );
  }
}

// POST - Criar um novo log de tarefa
export async function POST(request: NextRequest) {
  try {
    const logData = await request.json();
    
    // Validar dados do log
    if (!logData.action || !logData.taskId || !logData.taskTitle || !logData.taskType || !logData.user) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: action, taskId, taskTitle, taskType, user' },
        { status: 400 }
      );
    }
    
    // Estrutura básica do log
    const log: TaskLog = {
      action: logData.action,
      taskId: logData.taskId,
      taskTitle: logData.taskTitle,
      taskType: logData.taskType,
      dateTime: logData.dateTime || new Date().toISOString(),
      user: logData.user,
      details: logData.details || ''
    };
    
    const docRef = await logsCollection.add(log);
    
    return NextResponse.json(
      { id: docRef.id, ...log },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao criar log:', error);
    return NextResponse.json(
      { error: 'Erro ao criar log' },
      { status: 500 }
    );
  }
}


