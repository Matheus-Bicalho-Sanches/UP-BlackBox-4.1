import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

// Interface para representar uma tarefa
interface Task {
  id?: string;
  title: string;
  description: string;
  date: string;
  estimatedHours: number;
  priority: string;
  assignedTo: string[];
  status: string;
  isCompleted: boolean;
  observations: string;
  createdAt: string;
  updatedAt: string;
}

// Referência para a coleção de tarefas diárias
const tasksCollection = adminDb.collection('tasks').doc('types').collection('diaria');

// GET - Buscar tarefas diárias
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');

    // Se um ID específico for fornecido, retorna apenas essa tarefa
    if (id) {
      const taskDoc = await tasksCollection.doc(id).get();

      if (!taskDoc.exists) {
        return NextResponse.json(
          { error: 'Tarefa não encontrada' },
          { status: 404 }
        );
      }

      const taskData = taskDoc.data() as Task;
      return NextResponse.json({ task: { id: taskDoc.id, ...taskData } });
    }

    // Preparar a consulta com filtros opcionais
    let query: FirebaseFirestore.Query = tasksCollection;

    if (status && status !== 'Todos') {
      query = query.where('status', '==', status);
    }

    // Buscar todas as tarefas com os filtros aplicados
    const snapshot = await query.orderBy('date', 'asc').orderBy('createdAt', 'desc').get();

    if (snapshot.empty) {
      return NextResponse.json({ tasks: [] });
    }

    let tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];

    // Filtrar por responsável se fornecido (feito no código pois o Firestore não suporta
    // facilmente filtros em arrays)
    if (assignedTo) {
      const assigneesList = assignedTo.split(',');
      tasks = tasks.filter(task => {
        if (!task.assignedTo || !Array.isArray(task.assignedTo)) return false;
        return task.assignedTo.some(assignee => 
          assigneesList.includes(assignee)
        );
      });
    }

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Erro ao buscar tarefas diárias:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar tarefas diárias' },
      { status: 500 }
    );
  }
}

// POST - Criar nova tarefa diária
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validar campos obrigatórios
    if (!body.title) {
      return NextResponse.json(
        { error: 'Título é obrigatório' },
        { status: 400 }
      );
    }

    // Criar a tarefa com os dados fornecidos
    const taskData: Task = {
      title: body.title,
      description: body.description || '',
      date: body.date || new Date().toISOString().split('T')[0],
      estimatedHours: Number(body.estimatedHours) || 1,
      priority: body.priority || 'Média',
      assignedTo: body.assignedTo || [],
      status: body.status || 'Não iniciada',
      isCompleted: body.isCompleted || false,
      observations: body.observations || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await tasksCollection.add(taskData);
    const newTask = { id: docRef.id, ...taskData };

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar tarefa diária:', error);
    return NextResponse.json(
      { error: 'Erro ao criar tarefa diária' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar tarefa diária existente
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID da tarefa é obrigatório' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Verificar se a tarefa existe
    const taskRef = tasksCollection.doc(id);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json(
        { error: 'Tarefa não encontrada' },
        { status: 404 }
      );
    }

    // Obter dados existentes
    const existingTask = taskDoc.data() as Partial<Task> || {};

    // Preparar os dados para atualização - usando um Record para compatibilidade com o Firestore
    const updateData: Record<string, any> = {
      title: body.title !== undefined ? body.title : existingTask.title || '',
      description: body.description !== undefined ? body.description : existingTask.description || '',
      date: body.date !== undefined ? body.date : existingTask.date || new Date().toISOString().split('T')[0],
      estimatedHours: body.estimatedHours !== undefined ? Number(body.estimatedHours) : existingTask.estimatedHours || 0,
      priority: body.priority !== undefined ? body.priority : existingTask.priority || 'Média',
      assignedTo: body.assignedTo !== undefined ? body.assignedTo : existingTask.assignedTo || [],
      status: body.status !== undefined ? body.status : existingTask.status || 'Não iniciada',
      isCompleted: body.isCompleted !== undefined ? body.isCompleted : existingTask.isCompleted || false,
      observations: body.observations !== undefined ? body.observations : existingTask.observations || '',
      updatedAt: new Date().toISOString()
    };

    // Se não existe createdAt, adicionar
    if (!existingTask.createdAt) {
      updateData.createdAt = new Date().toISOString();
    }

    await taskRef.update(updateData);
    
    // Para retorno, montamos um objeto Task completo
    const taskData: Task = {
      ...updateData,
      createdAt: existingTask.createdAt || updateData.createdAt
    } as Task;
    
    const updatedTask = { id, ...taskData };

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Erro ao atualizar tarefa diária:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar tarefa diária' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir tarefa diária
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID da tarefa é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se a tarefa existe
    const taskRef = tasksCollection.doc(id);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json(
        { error: 'Tarefa não encontrada' },
        { status: 404 }
      );
    }

    // Excluir a tarefa
    await taskRef.delete();

    return NextResponse.json({ success: true, message: 'Tarefa excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir tarefa diária:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir tarefa diária' },
      { status: 500 }
    );
  }
} 