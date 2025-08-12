import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Modal, TouchableOpacity } from 'react-native';
import { useAgendamentos } from '../context/AgendamentoContext';

export default function EstatisticasScreen() {
  const { agendamentos } = useAgendamentos();
  const [modalVisible, setModalVisible] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState('');
  const [atendimentosSelecionados, setAtendimentosSelecionados] = useState(0);

  const hoje = new Date();
  const diaHojeStr = hoje.toISOString().slice(0, 10); // "yyyy-mm-dd"
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const contar = (lista, campo) => {
    const map = {};
    lista.forEach(item => {
      const chave = item[campo];
      map[chave] = (map[chave] || 0) + 1;
    });
    return map;
  };

  const encontrarMaior = (obj) => {
    let maiorValor = 0;
    let chaveMaior = '-';
    for (const chave in obj) {
      if (obj[chave] > maiorValor) {
        maiorValor = obj[chave];
        chaveMaior = chave;
      }
    }
    return chaveMaior;
  };

  const parseData = (dataStr) => {
    const [a, m, d] = dataStr.split('-');
    return new Date(parseInt(a), parseInt(m) - 1, parseInt(d));
  };

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };
  const semanaAtual = getWeekNumber(hoje);

  const agendamentosDia = agendamentos.filter(a => a.data.split('T')[0] === diaHojeStr);
  const agendamentosMes = agendamentos.filter(a => {
    const d = parseData(a.data.split('T')[0]);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });
  const agendamentosSemana = agendamentos.filter(a => {
    const d = parseData(a.data.split('T')[0]);
    return getWeekNumber(d) === semanaAtual && d.getFullYear() === anoAtual;
  });

  const agendamentosConcluidosDia = agendamentosDia.filter(a => a.status === 'concluido');
  const agendamentosConcluidosSemana = agendamentosSemana.filter(a => a.status === 'concluido');
  const agendamentosConcluidosMes = agendamentosMes.filter(a => a.status === 'concluido');

  // Soma receita real dos agendamentos concluídos
  const receitaDia = agendamentosConcluidosDia.reduce((total, ag) => total + Number(ag.valor || 0), 0);
  const receitaSemana = agendamentosConcluidosSemana.reduce((total, ag) => total + Number(ag.valor || 0), 0);
  const receitaMes = agendamentosConcluidosMes.reduce((total, ag) => total + Number(ag.valor || 0), 0);

  const servicosDia = contar(agendamentosDia, 'servico');
  const servicosSemana = contar(agendamentosSemana, 'servico');
  const servicosMes = contar(agendamentosMes, 'servico');

  const clientesSemana = contar(agendamentosSemana, 'cliente_nome');
  const clientesMes = contar(agendamentosMes, 'cliente_nome');

  const agendamentosCountDia = agendamentosDia.length;
  const agendamentosCountSemana = agendamentosSemana.length;
  const agendamentosCountMes = agendamentosMes.length;

  const servicoMaisFeitoDia = encontrarMaior(servicosDia);
  const servicoMaisFeitoSemana = encontrarMaior(servicosSemana);
  const servicoMaisFeitoMes = encontrarMaior(servicosMes);

  const clienteMaisSaiuSemana = encontrarMaior(clientesSemana);
  const clienteMaisSaiuMes = encontrarMaior(clientesMes);

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const contagemPorDiaSemana = [0, 0, 0, 0, 0, 0, 0];
  agendamentos.forEach(({ data }) => {
    const d = parseData(data.split('T')[0]);
    contagemPorDiaSemana[d.getDay()]++;
  });

  const handleDiaSemanaPress = (index) => {
    setDiaSelecionado(diasSemana[index]);
    setAtendimentosSelecionados(contagemPorDiaSemana[index]);
    setModalVisible(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40, alignItems: 'center' }}>
      <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.barbeariaNome}>Barber Shop</Text>

      <Text style={styles.titulo}>📊 Estatísticas</Text>

      <Text style={styles.sectionTitle}>📅 Dados do Dia Atual ({diaHojeStr})</Text>
      <Text style={styles.item}>Agendamentos: <Text style={styles.valor}>{agendamentosCountDia}</Text></Text>
      <Text style={styles.item}>Receita total: <Text style={styles.valor}>R$ {receitaDia.toFixed(2)}</Text></Text>
      <Text style={styles.item}>Serviço mais feito: <Text style={styles.valor}>{servicoMaisFeitoDia}</Text></Text>

      <Text style={styles.sectionTitle}>📅 Dados da Semana Atual (Semana {semanaAtual})</Text>
      <Text style={styles.item}>Agendamentos: <Text style={styles.valor}>{agendamentosCountSemana}</Text></Text>
      <Text style={styles.item}>Receita total: <Text style={styles.valor}>R$ {receitaSemana.toFixed(2)}</Text></Text>
      <Text style={styles.item}>Serviço mais feito: <Text style={styles.valor}>{servicoMaisFeitoSemana}</Text></Text>
      <Text style={styles.item}>Cliente que mais saiu: <Text style={styles.valor}>{clienteMaisSaiuSemana}</Text></Text>

      <Text style={styles.sectionTitle}>📅 Dados do Mês Atual ({(mesAtual + 1).toString().padStart(2, '0')}/{anoAtual})</Text>
      <Text style={styles.item}>Agendamentos: <Text style={styles.valor}>{agendamentosCountMes}</Text></Text>
      <Text style={styles.item}>Receita total: <Text style={styles.valor}>R$ {receitaMes.toFixed(2)}</Text></Text>
      <Text style={styles.item}>Serviço mais feito: <Text style={styles.valor}>{servicoMaisFeitoMes}</Text></Text>
      <Text style={styles.item}>Cliente que mais saiu: <Text style={styles.valor}>{clienteMaisSaiuMes}</Text></Text>

      <Text style={styles.sectionTitle}>📅 Atendimentos por Dia da Semana</Text>
      {diasSemana.map((dia, i) => (
        <TouchableOpacity key={dia} onPress={() => handleDiaSemanaPress(i)} style={styles.listItemTouchable}>
          <Text style={styles.listItem}>
            {dia}: <Text style={styles.valor}>{contagemPorDiaSemana[i]}</Text>
          </Text>
        </TouchableOpacity>
      ))}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{diaSelecionado}</Text>
            <Text style={styles.modalText}>{atendimentosSelecionados} atendimento(s)</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#121212',
    flex: 1,
    padding: 20,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 12,
    alignSelf: 'center',
  },
  barbeariaNome: {
    fontSize: 28,
    color: '#dab664',
    fontWeight: 'bold',
    marginBottom: 16,
    fontFamily: 'serif',
    letterSpacing: 2,
    alignSelf: 'center',
  },
  titulo: {
    color: '#dab664',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    alignSelf: 'center',
  },
  sectionTitle: {
    color: '#4caf50',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  item: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  valor: {
    color: '#dab664',
    fontWeight: 'bold',
  },
  listItem: {
    color: '#aaa',
    marginLeft: 10,
    fontSize: 14,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  listItemTouchable: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 25,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#dab664',
    marginBottom: 10,
  },
  modalText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  modalCloseButton: {
    backgroundColor: '#dab664',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCloseText: {
    fontWeight: 'bold',
    color: '#121212',
    fontSize: 16,
  },
});
