import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Easing,
  Modal,
  TextInput,
  Pressable
} from 'react-native';

/**
 * Componente: MascotaWidget (Evolutiva & Animada)
 * Gamificación y Retención mediante hábitos de riego.
 */
export default function MascotaWidget({ 
  nombreInicial = "Espina", 
  racha = 12, 
  estado = "happy", // 'happy' | 'hungry' | 'critical'
  onAlimentar 
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [modalVisible, setModalVisible] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [nuevoNombreInput, setNuevoNombreInput] = useState("");

  // --- ANIMACIONES CON REACT NATIVE NATIVE DRIVER ---
  const animFlotacion = useRef(new Animated.Value(0)).current;
  const animEscala = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animación de "Respiración / Flotación Continua"
    Animated.loop(
      Animated.sequence([
        Animated.timing(animFlotacion, {
          toValue: -8,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animFlotacion, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Algoritmo de Evolución y Recompensas por Racha
  const obtenerEtapaEvolutiva = (diasRacha) => {
    if (diasRacha >= 30) {
      return { nivel: 4, etapa: "Guardiana Leyenda", icono: "👑", color: "#FFD700", permiteRenombrar: true };
    }
    if (diasRacha >= 14) {
      return { nivel: 3, etapa: "Cactus Florecido", icono: "🌸", color: "#E91E63", permiteRenombrar: true };
    }
    if (diasRacha >= 5) {
      return { nivel: 2, etapa: "Cactus Bebé", icono: "🌵", color: "#2E7D32", permiteRenombrar: true };
    }
    return { nivel: 1, etapa: "Brote Semilla", icono: "🌱", color: "#8BC34A", permiteRenombrar: false };
  };

  const evolucion = obtenerEtapaEvolutiva(racha);

  // Efecto de rebote al presionar
  const animarPresion = () => {
    Animated.sequence([
      Animated.timing(animEscala, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(animEscala, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true })
    ]).start();
  };

  const handleAbrirMenu = () => {
    animarPresion();
    setModoEdicion(false);
    setModalVisible(true);
  };

  const handleEjecutarRiego = () => {
    if (onAlimentar) {
      onAlimentar();
    }
    setModalVisible(false);
  };

  const handleGuardarNombre = () => {
    if (nuevoNombreInput.trim().length > 0) {
      setNombre(nuevoNombreInput.trim());
      setNuevoNombreInput("");
      setModoEdicion(false);
    }
  };

  return (
    <>
      {/* MASCOTA FLOTANTE EN PANTALLA */}
      <Animated.View 
        style={[
          styles.containerFlotante, 
          { 
            transform: [
              { translateY: animFlotacion },
              { scale: animEscala }
            ] 
          }
        ]}
      >
        <TouchableOpacity 
          onPress={handleAbrirMenu}
          activeOpacity={0.8}
          style={styles.touchTarget}
        >
          {/* Badge de Nivel Evolutivo */}
          <View style={[styles.badgeNivel, { backgroundColor: evolucion.color }]}>
            <Text style={styles.textoNivel}>Nv.{evolucion.nivel}</Text>
          </View>

          {/* Badge de Racha Acumulada */}
          <View style={styles.badgeRacha}>
            <Text style={styles.textoRacha}>🔥 {racha}d</Text>
          </View>

          {/* Avatar de la Mascota */}
          <View style={[
            styles.avatarContainer, 
            { borderColor: evolucion.color },
            estado !== 'happy' && styles.avatarHambriento
          ]}>
            <Image 
              source={require('../../assets/icon.png')}
              style={styles.imagenMascota}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* MODAL INTERACTIVO MULTIPLATAFORMA (ANDROID / IOS / WEB) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            
            {/* Header del Modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcono}>{evolucion.icono}</Text>
              <Text style={styles.modalTitulo}>{nombre}</Text>
              <Text style={[styles.modalEtapa, { color: evolucion.color }]}>
                Nivel {evolucion.nivel} — {evolucion.etapa}
              </Text>
            </View>

            {/* Estado e Información */}
            <View style={styles.infoContainer}>
              <Text style={styles.infoTexto}>
                🔥 <Text style={styles.infoBold}>Racha actual:</Text> {racha} días consecutivos.
              </Text>
              <Text style={styles.infoTexto}>
                ❤️ <Text style={styles.infoBold}>Salud:</Text> {estado === 'happy' ? '¡Satisfecha y radiante!' : '¡Hambrienta! Se requiere riego.'}
              </Text>
            </View>

            {/* Formulario de Cambio de Nombre (si racha >= 5) */}
            {modoEdicion ? (
              <View style={styles.edicionContainer}>
                <TextInput
                  style={styles.inputNombre}
                  placeholder="Ingresa nuevo nombre..."
                  value={nuevoNombreInput}
                  onChangeText={setNuevoNombreInput}
                  autoFocus
                />
                <View style={styles.rowBotones}>
                  <TouchableOpacity style={styles.btnCancelar} onPress={() => setModoEdicion(false)}>
                    <Text style={styles.btnTextoSecundario}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardarNombre}>
                    <Text style={styles.btnTextoBlanco}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Botones de Acción Principal */
              <View style={styles.accionesContainer}>
                <TouchableOpacity style={styles.btnPrincipal} onPress={handleEjecutarRiego}>
                  <Text style={styles.btnTextoBlanco}>💧 Alimentar (Registrar Riego)</Text>
                </TouchableOpacity>

                {evolucion.permiteRenombrar ? (
                  <TouchableOpacity style={styles.btnSecundario} onPress={() => setModoEdicion(true)}>
                    <Text style={styles.btnTextoSecundario}>✏️ Cambiar Nombre</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.textoBloqueado}>
                    🔒 Alcanza 5 días de racha para personalizar el nombre.
                  </Text>
                )}

                <TouchableOpacity style={styles.btnCerrar} onPress={() => setModalVisible(false)}>
                  <Text style={styles.btnTextoCerrar}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            )}

          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  containerFlotante: {
    position: 'absolute',
    bottom: 95,
    right: 20,
    zIndex: 9999,
    elevation: 10,
  },
  touchTarget: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
  },
  avatarContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E8F5E9',
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  avatarHambriento: {
    backgroundColor: '#FFEBEE',
    borderColor: '#D32F2F',
  },
  imagenMascota: {
    width: 46,
    height: 46,
    resizeMode: 'contain',
  },
  badgeRacha: {
    position: 'absolute',
    top: -3,
    right: -2,
    backgroundColor: '#FF6F00',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFF',
    zIndex: 10,
  },
  textoRacha: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  badgeNivel: {
    position: 'absolute',
    top: -3,
    left: -2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFF',
    zIndex: 10,
  },
  textoNivel: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // ESTILOS DEL MODAL MULTIPLATAFORMA
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIcono: {
    fontSize: 42,
    marginBottom: 4,
  },
  modalTitulo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalEtapa: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  infoContainer: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  infoTexto: {
    fontSize: 13,
    color: '#444',
    marginVertical: 2,
  },
  infoBold: {
    fontWeight: '700',
  },
  accionesContainer: {
    width: '100%',
    alignItems: 'center',
  },
  btnPrincipal: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSecundario: {
    width: '100%',
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnTextoBlanco: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  btnTextoSecundario: {
    color: '#333333',
    fontWeight: '600',
    fontSize: 14,
  },
  btnCerrar: {
    marginTop: 6,
    padding: 8,
  },
  btnTextoCerrar: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '500',
  },
  textoBloqueado: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    marginVertical: 8,
  },
  edicionContainer: {
    width: '100%',
  },
  inputNombre: {
    borderWidth: 1.5,
    borderColor: '#7BA44D',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  rowBotones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btnCancelar: {
    flex: 1,
    marginRight: 6,
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnGuardar: {
    flex: 1,
    marginLeft: 6,
    backgroundColor: '#7BA44D',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
});