// debug.js - Ferramenta de diagnóstico para o sistema de vagas/gaiolas
// Adicione <script src="debug.js"></script> ao seu HTML para usar

(function() {
  console.log("🛠️ Ferramenta de diagnóstico carregada");
  
  // Objeto global de diagnóstico
  window.AGD = {
    version: "1.0.0",
    
    // Diagnóstico de dados dos drivers
    checkDrivers: function() {
      try {
        const driversArray = JSON.parse(localStorage.getItem('drivers_data') || '[]');
        const driversObj = JSON.parse(localStorage.getItem('drivers_data_obj') || '{}');
        
        console.group("📊 Diagnóstico de Motoristas");
        console.log(`Total (formato array): ${driversArray.length}`);
        console.log(`Total (formato objeto): ${Object.keys(driversObj).length}`);
        
        // Verificar tipos de veículo
        const comTipoVeiculo = driversArray.filter(d => d.tipoVeiculo).length;
        console.log(`Motoristas com tipo de veículo definido: ${comTipoVeiculo} (${Math.round(comTipoVeiculo/driversArray.length*100)}%)`);
        
        // Verificar inconsistências
        const inconsistencias = [];
        driversArray.forEach(driver => {
          if (!driver.id || !driver.gaiola || !driver.motorista) {
            inconsistencias.push(`Driver sem dados obrigatórios: ${JSON.stringify(driver)}`);
          }
        });
        
        if (inconsistencias.length > 0) {
          console.warn("⚠️ Inconsistências encontradas:", inconsistencias);
        } else {
          console.log("✅ Nenhuma inconsistência encontrada nos dados dos motoristas");
        }
        
        console.groupEnd();
        return {
          totalArray: driversArray.length,
          totalObj: Object.keys(driversObj).length,
          comTipoVeiculo,
          inconsistencias
        };
      } catch (error) {
        console.error("❌ Erro ao verificar dados dos motoristas:", error);
        return { error: error.message };
      }
    },
    
    // Diagnóstico de vagas
    checkVagas: function() {
      try {
        const vagas = {};
        const vagasVirtuais = {};
        const problemas = [];
        
        // Buscar todas as chaves no localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          
          // Identificar vagas pelo prefixo
          if (key && key.startsWith('vaga_')) {
            try {
              const data = JSON.parse(localStorage.getItem(key));
              vagas[key] = data;
              
              // Verificar problemas comuns
              if (!data.id) problemas.push(`Vaga sem ID: ${key}`);
              if (data.status === "chamado" && !data.gaiola) problemas.push(`Vaga ${key} chamada sem gaiola associada`);
            } catch (e) {
              problemas.push(`Erro ao ler vaga ${key}: ${e.message}`);
            }
          }
          
          // Identificar vagas virtuais pelo formato vagaXX
          if (key && key.match(/^vaga\d{2}$/)) {
            try {
              const data = JSON.parse(localStorage.getItem(key));
              vagasVirtuais[key] = data;
            } catch (e) {
              problemas.push(`Erro ao ler vaga virtual ${key}: ${e.message}`);
            }
          }
        }
        
        console.group("🚪 Diagnóstico de Vagas");
        console.log(`Total de vagas encontradas: ${Object.keys(vagas).length}`);
        console.log(`Total de vagas virtuais encontradas: ${Object.keys(vagasVirtuais).length}`);
        
        if (problemas.length > 0) {
          console.warn("⚠️ Problemas encontrados:", problemas);
        } else {
          console.log("✅ Nenhum problema encontrado nos dados das vagas");
        }
        
        console.groupEnd();
        return {
          total: Object.keys(vagas).length,
          virtuais: Object.keys(vagasVirtuais).length,
          problemas
        };
      } catch (error) {
        console.error("❌ Erro ao verificar vagas:", error);
        return { error: error.message };
      }
    },
    
    // Reparar problemas comuns
    repararProblemas: function() {
      try {
        console.group("🔧 Reparo de problemas");
        
        // Verificar vagas com status chamado mas sem gaiola
        let reparos = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('vaga_')) {
            try {
              const data = JSON.parse(localStorage.getItem(key));
              if (data.status === "chamado" && !data.gaiola) {
                console.log(`Reparando vaga ${key}: status chamado sem gaiola`);
                data.status = "esperar";
                localStorage.setItem(key, JSON.stringify(data));
                reparos++;
              }
            } catch (e) {
              // Ignorar erros de parsing
            }
          }
        }
        
        console.log(`${reparos} reparos realizados`);
        console.groupEnd();
        return { reparos };
      } catch (error) {
        console.error("❌ Erro ao reparar problemas:", error);
        return { error: error.message };
      }
    },
    
    // Mostrar versão do sistema
    about: function() {
      console.log(`
🔍 Sistema de Diagnóstico Agil Driver v${this.version}
---------------------------------------------------
Use os seguintes comandos:
- AGD.checkDrivers() - Verificar dados dos motoristas
- AGD.checkVagas() - Verificar dados das vagas
- AGD.repararProblemas() - Tentar reparar problemas comuns
      `);
    }
  };
  
  // Executar diagnóstico inicial
  setTimeout(() => {
    console.log("🔍 Executando diagnóstico inicial...");
    AGD.about();
  }, 2000);
})();
