import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
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
# SCALE DATA
# =========================
print("📊 Scaling data...")
scaler = MinMaxScaler()
data_scaled = scaler.fit_transform(df)

joblib.dump(scaler, "models/scaler_lstm.pkl")
print("✅ Scaler disimpan")

# =========================
# CREATE SEQUENCE
# =========================
def create_sequence(data, step=24):
    X, y = [], []
    target_index = df.columns.get_loc(TARGET)

    total = len(data) - step
    print(f"🔄 Membuat sequence total: {total}")

    for i in range(total):
        if i % 5000 == 0:
            print(f"Progress sequence: {i}/{total}")

        X.append(data[i:i+step])
        y.append(data[i+step][target_index])

    print("✅ Sequence selesai")
    return np.array(X), np.array(y)

X_seq, y_seq = create_sequence(data_scaled)

print("Shape X:", X_seq.shape)
print("Shape y:", y_seq.shape)

# =========================
# TRAIN TEST SPLIT (🔥 WAJIB)
# =========================
split = int(len(X_seq) * 0.8)

X_train, X_test = X_seq[:split], X_seq[split:]
y_train, y_test = y_seq[:split], y_seq[split:]

print("Train:", X_train.shape)
print("Test :", X_test.shape)

# =========================
# LSTM
# =========================
print("🚀 Training LSTM...")

model = Sequential([
    LSTM(64, return_sequences=True, input_shape=(X_seq.shape[1], X_seq.shape[2])),
    LSTM(32),
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
print("✅ LSTM selesai disimpan")

# =========================
# BiLSTM
# =========================
print("🚀 Training BiLSTM...")

bilstm = Sequential([
    Bidirectional(LSTM(64, return_sequences=True), input_shape=(X_seq.shape[1], X_seq.shape[2])),
    Bidirectional(LSTM(32)),
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
print("✅ BiLSTM selesai disimpan")

print("🎉 SEMUA TRAINING SELESAI")