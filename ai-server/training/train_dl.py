import os
import joblib
import traceback
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from config import MODEL_FOLDER, TARGET, STEP, TRAIN_VARS


def train_dl_models(df, target_var: str = None, cancel_check=None):
    if target_var is None:
        target_var = TARGET

    try:
        import tensorflow as tf
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import LSTM as KerasLSTM, Bidirectional, Dense, Dropout
        from tensorflow.keras.callbacks import EarlyStopping, Callback

        # ✅ Paksa CPU saja — hindari GPU memory conflict antar thread
        tf.config.set_visible_devices([], 'GPU')

        class CancelCallback(Callback):
            def __init__(self, check_fn):
                super().__init__()
                self.check_fn = check_fn

            def on_epoch_end(self, epoch, logs=None):
                if self.check_fn():
                    print("🛑 Training DL dihentikan via cancel")
                    self.model.stop_training = True

        if target_var not in df.columns:
            print(f"⚠️ Kolom {target_var} tidak ada, skip DL")
            return False

        dl_cols  = [c for c in df.columns if c != target_var]
        n_rows       = len(df)
        split_train_rows = int(n_rows * 0.8)

        X_all = df[dl_cols].values
        y_all = df[target_var].values.reshape(-1, 1)

        scaler_X = MinMaxScaler()
        scaler_y = MinMaxScaler()

        scaler_X.fit(X_all[:split_train_rows])  # ← fit di 80% saja
        scaler_y.fit(y_all[:split_train_rows])  # ← fit di 80% saja

        X_scaled = scaler_X.transform(X_all).astype(np.float32)  # ← transform semua
        y_scaled = scaler_y.transform(y_all).astype(np.float32)  # ← transform semua

        # ✅ Vectorized sequence building — jauh lebih cepat dari loop Python
        n        = len(X_scaled)
        indices  = np.arange(STEP, n)
        seqs     = np.array([X_scaled[i - STEP:i] for i in indices], dtype=np.float32)
        targets  = y_scaled[STEP:]

        n_feat = seqs.shape[2]
        suffix = f"_{target_var}"

        # ✅ Split train/val manual — lebih efisien dari validation_split
        split_train = int(len(seqs) * 0.8)
        split_val   = int(len(seqs) * 0.9)

        X_train, X_val = seqs[:split_train],   seqs[split_train:split_val]
        y_train, y_val = targets[:split_train], targets[split_train:split_val]

        es = EarlyStopping(
            monitor="val_loss",
            patience=5,                # ✅ tetap 5 — cukup untuk 87K rows
            restore_best_weights=True,
            min_delta=0.0001           # ✅ BARU: abaikan improvement terlalu kecil
        )

        callbacks = [es]
        if cancel_check:
            callbacks.append(CancelCallback(cancel_check))

        # ✅ Fungsi build model — hindari duplikasi kode
        def build_and_train(model, name):
            model.compile(optimizer="adam", loss="mse")
            model.fit(
                X_train, y_train,
                validation_data=(X_val, y_val),
                epochs=30,             # ✅ naik dari 10 → 30, beri ruang konvergen
                batch_size=512,        # ✅ tetap 512, oke untuk 87K rows
                callbacks=callbacks,
                verbose=1
            )
            model.save(f"{MODEL_FOLDER}/{name}{suffix}.h5")
            print(f"✅ {name}{suffix} disimpan")

        # =========================
        # LSTM
        # ✅ Diperkuat: n_feat ~26 + STEP=48, layer lama terlalu kecil
        # =========================
        lstm = Sequential([
            KerasLSTM(64, return_sequences=True, input_shape=(STEP, n_feat)),  # 32 → 64
            KerasLSTM(32),                                                      # 16 → 32
            Dropout(0.2),
            Dense(16, activation="relu"),                                       # 8 → 16
            Dense(1)
        ])
        build_and_train(lstm, "lstm")

        # ✅ Clear session sebelum build model berikutnya — bebaskan memory
        tf.keras.backend.clear_session()

        # =========================
        # BiLSTM
        # =========================
        bilstm = Sequential([
            Bidirectional(KerasLSTM(32, input_shape=(STEP, n_feat))),
            Dropout(0.3),              # ✅ naik dari 0.2 → 0.3, kurangi gap MAE
            Dense(8, activation="relu"),
            Dense(1)
        ])

        # ✅ Reload callbacks karena clear_session
        callbacks = [
            EarlyStopping(
                monitor="val_loss",
                patience=5,            # ✅ tetap 5
                restore_best_weights=True,
                min_delta=0.0001       # ✅ BARU: sama seperti LSTM
            )
        ]
        if cancel_check:
            callbacks.append(CancelCallback(cancel_check))

        bilstm.compile(optimizer="adam", loss="mse")
        bilstm.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=30,                 # ✅ naik dari 10 → 30
            batch_size=512,            # ✅ tetap 512
            callbacks=callbacks,
            verbose=1
        )
        bilstm.save(f"{MODEL_FOLDER}/bilstm{suffix}.h5")
        print(f"✅ bilstm{suffix} disimpan")

        # ✅ Simpan scaler dan dl_cols
        joblib.dump(scaler_X, f"{MODEL_FOLDER}/scaler_X{suffix}.pkl")
        joblib.dump(scaler_y, f"{MODEL_FOLDER}/scaler_y{suffix}.pkl")
        joblib.dump(dl_cols,  f"{MODEL_FOLDER}/dl_cols{suffix}.pkl")

        print(f"✅ DL training selesai untuk {target_var}")
        return True

    except Exception as e:
        print(f"⚠️ DL training gagal untuk {target_var}: {e}")
        traceback.print_exc()
        return False