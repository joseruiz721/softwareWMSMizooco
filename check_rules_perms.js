// Verificar reglas y permisos
require('dotenv').config();
const { queryAsync } = require('./utils/queryAsync');

async function checkRulesAndPerms() {
  try {
    console.log('🔍 VERIFICANDO REGLAS Y PERMISOS...\n');

    // Verificar reglas (RULES)
    const rules = await queryAsync(`
      SELECT rulename, definition
      FROM pg_rules
      WHERE tablename = 'usuarios'
    `);
    console.log('📋 REGLAS en tabla usuarios:', rules.length);
    rules.forEach(r => console.log('  -', r.rulename, r.definition));

    // Verificar permisos
    const perms = await queryAsync(`
      SELECT grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_name = 'usuarios'
    `);
    console.log('\n🔐 PERMISOS en tabla usuarios:');
    perms.forEach(p => console.log(`  - ${p.grantee}: ${p.privilege_type}`));

    // Verificar si hay otros triggers
    const allTriggers = await queryAsync(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'usuarios'
    `);
    console.log('\n🎯 TODOS LOS TRIGGERS:');
    allTriggers.forEach(t => console.log(`  - ${t.trigger_name}: ${t.event_manipulation} -> ${t.action_statement.substring(0, 50)}...`));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkRulesAndPerms();