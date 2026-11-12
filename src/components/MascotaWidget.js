// flora_app/src/components/MascotaWidget.js
/**
 * MascotaWidget - Botón flotante de Espina (Agenda), conectado a PetContext.
 *
 * - ARRASTRABLE: se mueve con el dedo y, al soltarla, se pega al borde izquierdo o derecho.
 * - MODO BURBUJA (densidad visual): mantén pulsada la mascota (o usa el botón del menú) para
 *   reducirla a una burbuja pequeña y translúcida que no tapa las filas de la lista.
 * - Posición y modo se guardan en SQLite (app_meta) y se restauran al abrir la app.
 *
 * Props:
 *   onAlimentar  se llama al pulsar "Alimentar (Registrar riego)"
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { usePet } from '../context/PetContext';
import { getMeta, setMeta } from '../services/db';
import { MOODS, RENAME_UNLOCK_DAYS } from '../utils/petFsm';
import DynamicPlantMascot from './DynamicPlantMascot';

const META_KEY = 'mascot_widget';
const FULL_SIZE = 68;
const BUBBLE_SIZE = 42;
const HIT_PADDING = 5;
const EDGE_MARGIN = 20; // coincide con right: 20 del ancla
const BOTTOM_ANCHOR = 95;
const TOP_RESERVED = 140; // encabezado de la pantalla

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function MascotaWidget({ onAlimentar }) {
  const { name, stage, mood, streak, statusText, counts, renamePet } = usePet();
  const { width, height } = useWindowDimensions();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [bubble, setBubble] = useState(false);

  const press = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const posRef = useRef({ x: 0, y: 0 });
  const sideRef = useRef('right');
  const bubbleRef = useRef(false);

  const pending = counts.due + counts.overdue;
  const needsWater = pending > 0;
  const canRename = streak.best >= RENAME_UNLOCK_DAYS;
  const stageIcon = stage.icon ?? 'cactus'; // nombre de MaterialCommunityIcons (petFsm.STAGES)

  // Límites del arrastre (relativos al ancla: abajo a la derecha)
  const boxSize = (bubble ? BUBBLE_SIZE : FULL_SIZE) + HIT_PADDING * 2;
  const boundsRef = useRef({ minX: 0, minY: 0, maxY: 0 });
  boundsRef.current = {
    minX: -(width - boxSize - EDGE_MARGIN * 2),
    minY: -(height - BOTTOM_ANCHOR - boxSize - TOP_RESERVED),
    maxY: 50,
  };

  const persist = useCallback((side, y, isBubble) => {
    setMeta(META_KEY, JSON.stringify({ side, y, bubble: isBubble })).catch(() => {});
  }, []);

  useEffect(() => {
    const id = pan.addListener((value) => {
      posRef.current = value;
    });
    return () => pan.removeListener(id);
  }, [pan]);

  // Restaurar posición y modo guardados
  useEffect(() => {
    let alive = true;
    getMeta(META_KEY)
      .then((raw) => {
        if (!raw || !alive) return;
        try {
          const saved = JSON.parse(raw);
          sideRef.current = saved.side === 'left' ? 'left' : 'right';
          bubbleRef.current = Boolean(saved.bubble);
          setBubble(Boolean(saved.bubble));
          const { minX, minY, maxY } = boundsRef.current;
          pan.setValue({
            x: sideRef.current === 'left' ? minX : 0,
            y: clamp(Number(saved.y) || 0, minY, maxY),
          });
        } catch {
          // dato corrupto: se ignora
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pan]);

  // Si cambia el tamaño (burbuja) o la pantalla, mantiene el borde donde estaba
  useEffect(() => {
    if (sideRef.current === 'left') {
      pan.setValue({ x: boundsRef.current.minX, y: posRef.current.y });
    }
  }, [bubble, width, pan]);

  const snap = useCallback(() => {
    const { minX, minY, maxY } = boundsRef.current;
    const { x, y } = posRef.current;
    const side = x < minX / 2 ? 'left' : 'right';
    const targetY = clamp(y, minY, maxY);
    sideRef.current = side;

    Animated.spring(pan, {
      toValue: { x: side === 'left' ? minX : 0, y: targetY },
      friction: 7,
      tension: 60,
      useNativeDriver: false,
    }).start();
    persist(side, targetY, bubbleRef.current);
  }, [pan, persist]);

  const snapRef = useRef(snap);
  snapRef.current = snap;

  const panResponder = useRef(
    PanResponder.create({
      // Captura el gesto solo si el dedo se mueve: un toque simple sigue abriendo el menú
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
      onPanResponderGrant: () => {
        pan.setOffset({ x: posRef.current.x, y: posRef.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        snapRef.current();
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        snapRef.current();
      },
    })
  ).current;

  const bounce = () => {
    Animated.sequence([
      Animated.timing(press, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(press, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }),
    ]).start();
  };

  const toggleBubble = () => {
    const next = !bubbleRef.current;
    bubbleRef.current = next;
    setBubble(next);
    persist(sideRef.current, posRef.current.y, next);
    bounce();
  };

  const openMenu = () => {
    bounce();
    setEditing(false);
    setModalVisible(true);
  };

  const handleFeed = () => {
    setModalVisible(false);
    onAlimentar?.();
  };

  const handleSaveName = async () => {
    const saved = await renamePet(draft);
    if (saved) {
      setDraft('');
      setEditing(false);
    }
  };

  return (
    <>
      {/* Mascota flotante (arrastrable) */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.floating, { transform: pan.getTranslateTransform() }]}
      >
        <Animated.View style={{ transform: [{ scale: press }] }}>
          <TouchableOpacity
            onPress={openMenu}
            onLongPress={toggleBubble}
            delayLongPress={450}
            activeOpacity={0.8}
            style={styles.touchTarget}
            accessibilityLabel={`Abrir a ${name}`}
            accessibilityHint="Mantén pulsado para cambiar entre mascota y burbuja. Arrástrala para moverla."
          >
            {!bubble && (
              <>
                <View style={[styles.levelBadge, { backgroundColor: stage.color }]}>
                  <Text style={styles.badgeText}>Nv.{stage.level}</Text>
                </View>

                <View style={styles.streakBadge}>
                  <Ionicons name="flame" size={11} color="#FFFFFF" />
                  <Text style={styles.badgeText}>{streak.current}d</Text>
                </View>
              </>
            )}

            {bubble && needsWater ? <View style={styles.bubbleDot} /> : null}

            <View
              style={[
                styles.avatar,
                bubble && styles.avatarBubble,
                { borderColor: needsWater ? '#D32F2F' : stage.color },
                needsWater && styles.avatarHungry,
              ]}
            >
              <DynamicPlantMascot
                due={counts.due}
                overdue={counts.overdue}
                streakDays={streak.current}
                isCelebrating={mood === MOODS.CELEBRANDO}
                resizeMode="cover"
                style={bubble ? styles.avatarImageBubble : styles.avatarImage}
              />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* Menú de la mascota */}
      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
            <View style={styles.header}>
              <MaterialCommunityIcons
                name={stageIcon}
                size={46}
                color={stage.color}
                style={styles.stageIcon}
              />
              <Text style={styles.title}>{name}</Text>
              <Text style={[styles.stageText, { color: stage.color }]}>
                Nivel {stage.level} — {stage.name}
              </Text>
            </View>

            <View style={styles.info}>
              <View style={styles.infoRow}>
                <Ionicons name="flame" size={16} color="#FF6F00" />
                <Text style={styles.infoText}>
                  <Text style={styles.bold}>Racha actual:</Text> {streak.current}{' '}
                  {streak.current === 1 ? 'día' : 'días'} (mejor: {Math.max(streak.best, streak.current)})
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="heart" size={16} color="#E53935" />
                <Text style={styles.infoText}>
                  <Text style={styles.bold}>Estado:</Text> {statusText}
                </Text>
              </View>
            </View>

            {editing ? (
              <View style={styles.editBox}>
                <TextInput
                  style={styles.input}
                  placeholder="Ingresa un nuevo nombre..."
                  value={draft}
                  onChangeText={setDraft}
                  maxLength={20}
                  autoFocus
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.btnCancel} onPress={() => setEditing(false)}>
                    <Text style={styles.btnTextDark}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnSave} onPress={handleSaveName}>
                    <Text style={styles.btnTextWhite}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.btnMain} onPress={handleFeed}>
                  <View style={styles.btnContent}>
                    <Ionicons name="water" size={18} color="#FFFFFF" />
                    <Text style={styles.btnTextWhite}>Alimentar (Registrar riego)</Text>
                  </View>
                </TouchableOpacity>

                {canRename ? (
                  <TouchableOpacity style={styles.btnSecondary} onPress={() => setEditing(true)}>
                    <View style={styles.btnContent}>
                      <Ionicons name="pencil" size={15} color="#333333" />
                      <Text style={styles.btnTextDark}>Cambiar nombre</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.lockedRow}>
                    <Ionicons name="lock-closed" size={13} color="#888888" />
                    <Text style={styles.locked}>
                      Alcanza {RENAME_UNLOCK_DAYS} días de racha para personalizar el nombre.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={() => {
                    setModalVisible(false);
                    toggleBubble();
                  }}
                >
                  <View style={styles.btnContent}>
                    <Ionicons name={bubble ? 'expand' : 'contract'} size={15} color="#333333" />
                    <Text style={styles.btnTextDark}>
                      {bubble ? 'Ampliar mascota' : 'Minimizar a burbuja'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnClose} onPress={() => setModalVisible(false)}>
                  <Text style={styles.btnCloseText}>Cerrar</Text>
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
  floating: {
    position: 'absolute',
    bottom: BOTTOM_ANCHOR,
    right: EDGE_MARGIN,
    zIndex: 9999,
    elevation: 10,
  },
  touchTarget: { alignItems: 'center', justifyContent: 'center', padding: HIT_PADDING },
  avatar: {
    width: FULL_SIZE,
    height: FULL_SIZE,
    borderRadius: FULL_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  avatarBubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 2,
    opacity: 0.85,
  },
  avatarHungry: { backgroundColor: '#FFEBEE' },
  avatarImage: { width: 62, height: 62, borderRadius: 31 },
  avatarImageBubble: { width: 38, height: 38, borderRadius: 19 },
  bubbleDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D32F2F',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 10,
  },
  streakBadge: {
    position: 'absolute',
    top: -3,
    right: -2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FF6F00',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFF',
    zIndex: 10,
  },
  levelBadge: {
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
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 20,
  },
  header: { alignItems: 'center', marginBottom: 16 },
  stageIcon: { marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
  stageText: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  info: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginVertical: 3 },
  infoText: { flex: 1, fontSize: 13, color: '#444' },
  bold: { fontWeight: '700' },
  actions: { width: '100%', alignItems: 'center' },
  btnMain: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSecondary: {
    width: '100%',
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnTextWhite: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  btnTextDark: { color: '#333333', fontWeight: '600', fontSize: 14 },
  btnClose: { marginTop: 6, padding: 8 },
  btnCloseText: { color: '#888888', fontSize: 13, fontWeight: '500' },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 },
  locked: { flexShrink: 1, fontSize: 11, color: '#888', textAlign: 'center' },
  editBox: { width: '100%' },
  input: {
    borderWidth: 1.5,
    borderColor: '#7BA44D',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  btnCancel: {
    flex: 1,
    marginRight: 6,
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnSave: {
    flex: 1,
    marginLeft: 6,
    backgroundColor: '#7BA44D',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
});