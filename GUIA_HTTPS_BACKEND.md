# 🔒 **GUIA: CONFIGURAR HTTPS NO BACKEND AZURE VM**

## 🚨 **PROBLEMA ATUAL:**
- Frontend HTTPS (Vercel) → Backend HTTP (Azure VM)
- **Mixed Content Error** - navegador bloqueia requisições HTTP de páginas HTTPS

---

## 🚀 **SOLUÇÃO: CONFIGURAR HTTPS NO BACKEND**

### **📋 PRÉ-REQUISITOS:**
- ✅ VM Azure rodando
- ✅ Backend FastAPI funcionando em HTTP
- ✅ Domínio configurado (ou usar IP público)

---

## **OPÇÃO 1: 🏆 USAR NGINX COMO REVERSE PROXY (RECOMENDADO)**

### **1. Instalar Nginx no Windows Server**

```powershell
# Na VM Azure (via RDP):
# Baixar Nginx para Windows
Invoke-WebRequest -Uri "http://nginx.org/download/nginx-1.24.0.zip" -OutFile "nginx.zip"
Expand-Archive -Path "nginx.zip" -DestinationPath "C:\nginx"
```

### **2. Configurar Nginx**

**Arquivo: `C:\nginx\conf\nginx.conf`**
```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server 127.0.0.1:8000;
    }

    server {
        listen 80;
        server_name 172.177.92.136;  # IP da VM
        
        # Redirecionar HTTP para HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl;
        server_name 172.177.92.136;  # IP da VM
        
        # Certificados SSL (auto-assinados para teste)
        ssl_certificate C:/nginx/certs/server.crt;
        ssl_certificate_key C:/nginx/certs/server.key;
        
        # Configurações SSL
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        
        # Proxy para FastAPI
        location / {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### **3. Gerar Certificados Auto-Assinados (TESTE)**

```powershell
# Criar pasta de certificados
New-Item -ItemType Directory -Path "C:\nginx\certs"

# Gerar certificado auto-assinado
$cert = New-SelfSignedCertificate -DnsName "172.177.92.136" -CertStoreLocation "cert:\LocalMachine\My"
$pwd = ConvertTo-SecureString -String "password123" -Force -AsPlainText
$path = "C:\nginx\certs\server.pfx"
Export-PfxCertificate -Cert $cert -FilePath $path -Password $pwd

# Converter para formato PEM
openssl pkcs12 -in C:\nginx\certs\server.pfx -out C:\nginx\certs\server.crt -clcerts -nokeys -passin pass:password123
openssl pkcs12 -in C:\nginx\certs\server.pfx -out C:\nginx\certs\server.key -nocerts -nodes -passin pass:password123
```

### **4. Iniciar Nginx**

```powershell
cd C:\nginx
.\nginx.exe
```

---

## **OPÇÃO 2: 🔧 USAR IIS COMO REVERSE PROXY**

### **1. Instalar IIS e ARR (Application Request Routing)**

```powershell
# Instalar IIS
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, IIS-HttpErrors, IIS-HttpLogging, IIS-RequestFiltering, IIS-StaticContent

# Baixar e instalar ARR
# https://www.iis.net/downloads/microsoft/application-request-routing
```

### **2. Configurar ARR no IIS**

1. Abrir **IIS Manager**
2. Selecionar servidor → **Application Request Routing Cache**
3. **Server Proxy Settings** → Habilitar proxy
4. Criar novo site com binding HTTPS
5. Configurar **URL Rewrite** para proxy para `http://localhost:8000`

---

## **OPÇÃO 3: ⚡ SOLUÇÃO RÁPIDA - USAR CLOUDFLARE TUNNEL**

### **1. Instalar Cloudflared**

```powershell
# Baixar cloudflared
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"
```

### **2. Criar Túnel**

```powershell
# Login no Cloudflare
.\cloudflared.exe tunnel login

# Criar túnel
.\cloudflared.exe tunnel create up-blackbox-backend

# Configurar túnel
.\cloudflared.exe tunnel route dns up-blackbox-backend api.up-gestora.com.br
```

### **3. Configurar Config**

**Arquivo: `%USERPROFILE%\.cloudflared\config.yml`**
```yaml
tunnel: up-blackbox-backend
credentials-file: %USERPROFILE%\.cloudflared\up-blackbox-backend.json

ingress:
  - hostname: api.up-gestora.com.br
    service: http://localhost:8000
  - service: http_status:404
```

### **4. Executar Túnel**

```powershell
.\cloudflared.exe tunnel run up-blackbox-backend
```

---

## **OPÇÃO 4: 🚀 SOLUÇÃO MAIS SIMPLES - NGINX BÁSICO**

### **1. Instalar Nginx via Chocolatey**

```powershell
# Instalar Chocolatey (se não tiver)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Instalar Nginx
choco install nginx -y
```

### **2. Configuração Simples**

**Arquivo: `C:\tools\nginx\conf\nginx.conf`**
```nginx
events {
    worker_connections 1024;
}

http {
    server {
        listen 443 ssl;
        server_name 172.177.92.136;
        
        # Certificados auto-assinados
        ssl_certificate C:/tools/nginx/certs/server.crt;
        ssl_certificate_key C:/tools/nginx/certs/server.key;
        
        location / {
            proxy_pass http://127.0.0.1:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

### **3. Gerar Certificados**

```powershell
# Usar PowerShell para gerar certificado
$cert = New-SelfSignedCertificate -DnsName "172.177.92.136" -CertStoreLocation "cert:\LocalMachine\My"
$pwd = ConvertTo-SecureString -String "123456" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "C:\tools\nginx\certs\server.pfx" -Password $pwd
```

---

## **🔧 ATUALIZAR FRONTEND**

Após configurar HTTPS, atualizar variável de ambiente:

```env
NEXT_PUBLIC_BACKEND_URL=https://172.177.92.136:8000
# ou se usar domínio:
NEXT_PUBLIC_BACKEND_URL=https://api.up-gestora.com.br
```

---

## **⚠️ IMPORTANTE:**

1. **Certificados auto-assinados** causarão avisos no navegador
2. **Para produção**, use certificados válidos (Let's Encrypt)
3. **Teste localmente** antes de atualizar o frontend
4. **Configure CORS** no backend para aceitar HTTPS

---

## **🎯 RECOMENDAÇÃO:**

**Use a OPÇÃO 4 (Nginx básico)** para começar rapidamente, depois migre para certificados válidos.
