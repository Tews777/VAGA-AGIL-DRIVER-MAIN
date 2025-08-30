// DEBUG: Verificar atribuição de vaga para motorista
// Execute este código no console do navegador para debug

console.log("🔍 DEBUG: Verificando atribuição de vagas para motoristas");

// Verificar dados dos motoristas
const driversData = localStorage.getItem('drivers_data');
if (driversData) {
  try {
    const drivers = JSON.parse(driversData);
    console.log("📊 Motoristas encontrados:", drivers.length);
    
    // Verificar motoristas com vaga atribuída
    const driversWithVaga = drivers.filter(d => d.vaga);
    console.log("🎯 Motoristas com vaga atribuída:", driversWithVaga.length);
    
    driversWithVaga.forEach(driver => {
      console.log(`✅ Motorista ${driver.gaiola} (${driver.name || driver.motorista}) -> Vaga ${driver.vaga} | Status: ${driver.status}`);
    });
    
    // Verificar motoristas em status "entrar_hub"
    const driversEntering = drivers.filter(d => d.status === "entrar_hub");
    console.log("🚪 Motoristas entrando no hub:", driversEntering.length);
    
    driversEntering.forEach(driver => {
      console.log(`🚚 ${driver.gaiola} -> Vaga ${driver.vaga || 'SEM VAGA'} | Status: ${driver.status}`);
    });
    
  } catch (error) {
    console.error("❌ Erro ao analisar dados dos motoristas:", error);
  }
} else {
  console.log("❌ Nenhum dado de motorista encontrado!");
}

// Verificar dados das vagas
console.log("\n📋 Verificando dados das vagas:");
for (let i = 1; i <= 20; i++) {
  const vagaKey = `vaga_data_vaga_${i.toString().padStart(2, '0')}_data`;
  const vagaData = localStorage.getItem(vagaKey);
  
  if (vagaData) {
    try {
      const vaga = JSON.parse(vagaData);
      if (vaga.gaiola) {
        console.log(`🏠 Vaga ${i}: ${vaga.gaiola} | Status: ${vaga.status} | Chamado: ${vaga.chamadoEm ? new Date(vaga.chamadoEm).toLocaleTimeString() : 'N/A'}`);
      }
    } catch (error) {
      console.error(`❌ Erro na vaga ${i}:`, error);
    }
  }
}

console.log("\n🔍 Debug concluído!");
