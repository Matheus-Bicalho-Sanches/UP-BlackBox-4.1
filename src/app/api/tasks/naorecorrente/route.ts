import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Query, CollectionReference } from 'firebase-admin/firestore';

// Interface para representar uma tarefa
interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  estimatedHours: number;
  priority: string;
  assignedTo: string[];
  status: string;
  observations: string;
  createdAt?: string;
  updatedAt?: string;
}

// Referência para a coleção de tarefas não recorrentes
const tasksCollection = adminDb.collection('tasks').doc('types').collection('naorecorrente');

// GET - Obter todas as tarefas não recorrentes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const dueDateFilter = searchParams.get('dueDate'); // Novo parâmetro para filtro de prazo

    let query: Query = tasksCollection;
    
    // Aplicar filtros se fornecidos
    if (status && status !== 'Todos') {
      query = query.where('status', '==', status);
    }
    
    // Filtro por prazo - No Firestore podemos filtrar por datas específicas
    // mas a ordenação será feita no cliente para maior flexibilidade
    if (dueDateFilter) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (dueDateFilter === 'today') {
        // Tarefas com prazo para hoje
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        query = query.where('dueDate', '>=', today.toISOString().split('T')[0])
                     .where('dueDate', '<', tomorrow.toISOString().split('T')[0]);
      } else if (dueDateFilter === 'week') {
        // Tarefas com prazo para esta semana
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        query = query.where('dueDate', '>=', today.toISOString().split('T')[0])
                     .where('dueDate', '<', nextWeek.toISOString().split('T')[0]);
      } else if (dueDateFilter === 'month') {
        // Tarefas com prazo para este mês
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        query = query.where('dueDate', '>=', today.toISOString().split('T')[0])
                     .where('dueDate', '<', nextMonth.toISOString().split('T')[0]);
      } else if (dueDateFilter === 'overdue') {
        // Tarefas com prazo vencido
        query = query.where('dueDate', '<', today.toISOString().split('T')[0]);
      }
    }
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return NextResponse.json({ tasks: [] }, { status: 200 });
    }
    
    let tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];
    
    // Filtrar por responsável se fornecido (feito no código pois o Firestore não suporta
    // facilmente filtros em arrays)
    if (assignedTo) {
      const assigneeList = assignedTo.split(',');
      tasks = tasks.filter(task => {
        if (Array.isArray(task.assignedTo)) {
          return task.assignedTo.some((assignee: string) => 
            assigneeList.includes(assignee)
          );
        }
        return false;
      });
    }
    
    return NextResponse.json({ tasks }, { status: 200 });
  } catch (error) {
    console.error('Erro ao obter tarefas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar tarefas' },
      { status: 500 }
    );
  }
}

// POST - Criar uma nova tarefa não recorrente
export async function POST(request: NextRequest) {
  try {
    const taskData = await request.json();
    
    // Validar dados da tarefa
    if (!taskData.title || !taskData.dueDate) {
      return NextResponse.json(
        { error: 'Título e data de prazo são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Estrutura básica da tarefa
    const task = {
      title: taskData.title,
      description: taskData.description || '',
      dueDate: taskData.dueDate,
      estimatedHours: taskData.estimatedHours || 0,
      priority: taskData.priority || 'Média',
      assignedTo: taskData.assignedTo || [],
      status: taskData.status || 'Não iniciada',
      observations: taskData.observations || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await tasksCollection.add(task);
    
    return NextResponse.json(
      { id: docRef.id, ...task },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao criar tarefa:', error);
    return NextResponse.json(
      { error: 'Erro ao criar tarefa' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar uma tarefa existente
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');
    
    if (!taskId) {
      return NextResponse.json(
        { error: 'ID da tarefa não fornecido' },
        { status: 400 }
      );
    }
    
    const taskData = await request.json();
    const taskRef = tasksCollection.doc(taskId);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists) {
      return NextResponse.json(
        { error: 'Tarefa não encontrada' },
        { status: 404 }
      );
    }
    
    // Adicionar data de atualização
    taskData.updatedAt = new Date().toISOString();
    
    await taskRef.update(taskData);
    
    return NextResponse.json(
      { id: taskId, ...taskData },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao atualizar tarefa:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar tarefa' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir uma tarefa
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');
    
    if (!taskId) {
      return NextResponse.json(
        { error: 'ID da tarefa não fornecido' },
        { status: 400 }
      );
    }
    
    const taskRef = tasksCollection.doc(taskId);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists) {
      return NextResponse.json(
        { error: 'Tarefa não encontrada' },
        { status: 404 }
      );
    }
    
    await taskRef.delete();
    
    return NextResponse.json(
      { message: 'Tarefa excluída com sucesso' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao excluir tarefa:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir tarefa' },
      { status: 500 }
    );
  }
} 