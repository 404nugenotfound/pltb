import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Bidirectional
import joblib

# =========================
# LOAD DATA
# =========================
print("📥 Load data...")
df = pd.read_csv("Dataset/NASA Bawean Hourly Full.csv")

TARGET = "WS10M"

# =========================
# FEATURE ENGINEERING
# =========================
print("⚙️ Feature engineering...")
for lag in [1, 2, 3, 24]:
    df[f"lag{lag}"] = df[TARGET].shift(lag)

df["mean3"] = df[TARGET].rolling(3).mean()
df["mean24"] = df[TARGET].rolling(24).mean()

df = df.dropna()
print("✅ Feature engineering selesai")

# =========================
# SPLIT FITUR & TARGET
# =========================
X = df.drop(columns=[TARGET])
y = df[[TARGET]]

# =========================
# SCALING (DIPISAH 🔥)
# =========================
print("📊 Scaling data...")
scaler_X = MinMaxScaler()
scaler_y = MinMaxScaler()

X_scaled = scaler_X.fit_transform(X)
y_scaled = scaler_y.fit_transform(y)

joblib.dump(scaler_X, "models/scaler_X.pkl")
joblib.dump(scaler_y, "models/scaler_y.pkl")
print("✅ Scaler disimpan")

# =========================
# CREATE SEQUENCE
# =========================
def create_sequence(X, y, step=48):  # 🔥 dinaikin dari 24 → 48
    Xs, ys = [], []
    for i in range(len(X) - step):
        if i % 5000 == 0:
            print(f"Progress sequence: {i}/{len(X)-step}")

        Xs.append(X[i:i+step])
        ys.append(y[i+step])

    return np.array(Xs), np.array(ys)

X_seq, y_seq = create_sequence(X_scaled, y_scaled)

print("Shape X:", X_seq.shape)
print("Shape y:", y_seq.shape)

# =========================
# TRAIN TEST SPLIT
# =========================
split = int(len(X_seq) * 0.8)

X_train, X_test = X_seq[:split], X_seq[split:]
y_train, y_test = y_seq[:split], y_seq[split:]

print("Train:", X_train.shape)
print("Test :", X_test.shape)

# =========================
# FUNCTION EVALUASI
# =========================
def evaluate(y_true, y_pred):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = np.mean(np.abs((y_true - y_pred) / (y_true + 1e-8))) * 100
    r2 = r2_score(y_true, y_pred)
    return mae, rmse, mape, r2

# =========================
# LSTM
# =========================
print("🚀 Training LSTM...")

model = Sequential([
    LSTM(128, return_sequences=True, input_shape=(X_seq.shape[1], X_seq.shape[2])),
    LSTM(64),
    Dense(32, activation='relu'),
    Dense(1)
])

model.compile(optimizer='adam', loss='mse')

model.fit(
    X_train, y_train,
    validation_data=(X_test, y_test),
    epochs=20,
    batch_size=32,
    verbose=1
)

model.save("models/lstm.h5")
print("✅ LSTM disimpan")

# 🔹 Prediksi + inverse scaling
y_pred_lstm = model.predict(X_test)

y_pred_lstm = scaler_y.inverse_transform(y_pred_lstm)
y_test_real = scaler_y.inverse_transform(y_test)

# 🔹 Evaluasi
mae, rmse, mape, r2 = evaluate(y_test_real, y_pred_lstm)

print("\n📊 HASIL LSTM")
print(f"MAE  : {mae:.3f}")
print(f"RMSE : {rmse:.3f}")
print(f"MAPE : {mape:.2f}%")
print(f"R²   : {r2:.3f}")

# =========================
# BiLSTM
# =========================
print("\n🚀 Training BiLSTM...")

bilstm = Sequential([
    Bidirectional(LSTM(128, return_sequences=True), input_shape=(X_seq.shape[1], X_seq.shape[2])),
    Bidirectional(LSTM(64)),
    Dense(32, activation='relu'),
    Dense(1)
])

bilstm.compile(optimizer='adam', loss='mse')

bilstm.fit(
    X_train, y_train,
    validation_data=(X_test, y_test),
    epochs=20,
    batch_size=32,
    verbose=1
)

bilstm.save("models/bilstm.h5")
print("✅ BiLSTM disimpan")

# 🔹 Prediksi + inverse scaling
y_pred_bilstm = bilstm.predict(X_test)

y_pred_bilstm = scaler_y.inverse_transform(y_pred_bilstm)

# 🔹 Evaluasi
mae, rmse, mape, r2 = evaluate(y_test_real, y_pred_bilstm)

print("\n📊 HASIL BiLSTM")
print(f"MAE  : {mae:.3f}")
print(f"RMSE : {rmse:.3f}")
print(f"MAPE : {mape:.2f}%")
print(f"R²   : {r2:.3f}")

print("\n🎉 SEMUA TRAINING & EVALUASI SELESAI")