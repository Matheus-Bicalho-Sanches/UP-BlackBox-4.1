import { NextResponse } from 'next/server'
import { TokenizeCardData } from '@/lib/asaas'

// Configuração para produção
const API_KEY = '$aact_MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjVkMjI1OGY3LTQ5YmQtNDYzNi1hNGRhLTFjOWJjN2YzODg5YTo6JGFhY2hfOGYwNTc5YmUtMmFhYy00NTkzLWExZjYtNDI3MzFjNWYxMjM0'
const BASE_URL = 'https://api.asaas.com/v3'

export async function POST(request: Request) {
  try {
    const data: TokenizeCardData = await request.json()
    
    // Log para debug
    console.log('Tentando tokenizar cartão:', {
      url: `${BASE_URL}/creditCard/tokenize`,
      customer: data.customer,
      hasApiKey: !!API_KEY,
      apiKeyLength: API_KEY.length,
      apiKeyStart: API_KEY.substring(0, 10)
    })
    
    if (!data.customer) {
      return NextResponse.json(
        { error: 'ID do cliente não fornecido' },
        { status: 400 }
      )
    }

    // Preparar payload de acordo com a documentação
    const payload = {
      customer: data.customer,
      creditCard: {
        holderName: data.creditCard.holderName,
        number: data.creditCard.number,
        expiryMonth: data.creditCard.expiryMonth.padStart(2, '0'),
        expiryYear: data.creditCard.expiryYear,
        ccv: data.creditCard.ccv
      },
      creditCardHolderInfo: {
        name: data.creditCard.holderName,
        email: data.creditCardHolderInfo?.email,
        cpfCnpj: data.creditCardHolderInfo?.cpfCnpj,
        postalCode: data.creditCardHolderInfo?.postalCode,
        addressNumber: data.creditCardHolderInfo?.addressNumber,
        addressComplement: data.creditCardHolderInfo?.addressComplement,
        phone: data.creditCardHolderInfo?.phone,
        mobilePhone: data.creditCardHolderInfo?.mobilePhone
      }
    }

    console.log('Payload completo:', {
      ...payload,
      creditCard: {
        ...payload.creditCard,
        number: `${payload.creditCard.number.substring(0, 4)}...${payload.creditCard.number.slice(-4)}`
      }
    })

    const response = await fetch(`${BASE_URL}/creditCard/tokenize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': API_KEY
      },
      body: JSON.stringify(payload)
    })

    const responseText = await response.text()
    console.log('Resposta bruta:', responseText)

    let responseData
    try {
      responseData = responseText ? JSON.parse(responseText) : null
      console.log('Resposta parseada:', responseData)
    } catch (e) {
      console.error('Erro ao fazer parse da resposta:', e)
      return NextResponse.json(
        { error: 'Erro ao processar resposta do Asaas' },
        { status: 500 }
      )
    }

    if (!response.ok) {
      console.error('Erro na resposta do Asaas:', responseData)
      return NextResponse.json(
        { error: responseData?.errors?.[0]?.description || responseData?.message || 'Erro ao tokenizar cartão' },
        { status: response.status }
      )
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Erro completo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
} 